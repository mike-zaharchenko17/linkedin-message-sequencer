import Fastify from "fastify"
import type { FastifyRequest, FastifyReply, FastifyError } from 'fastify'
import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts"
import { gsOpts } from "./schemas/generate-sequence.schema.js"
import { pool } from "../db/pool.js"
import { generateSequencePrompt } from "../openai/prompt-factories/sequence.js"
import generateLinkedInProfileStub from "../lib/linkedin-profile-stub.js"
import { insertProspectSelectOnConflict, insertTovConfigSelectOnConflict, insertMessageSequence, insertMultipleMessages, insertAiGeneration } from "../db/callbacks.js"
import { VERIFICATION_KEY } from "../config/env.js"
import { openAiClient } from "../openai/client.js"
import { ProspectStub } from "../db/types.js"
import { zodTextFormat } from "openai/helpers/zod.js"
import { MessageSequenceJsonString } from "../openai/types.js"
import { db } from "../db/client.js"
import { generateAnalysisPrompt } from "../openai/prompt-factories/analysis.js"
import sensible from "@fastify/sensible"

const fastify = Fastify({ logger: true }).withTypeProvider<JsonSchemaToTsProvider>()
type FastifyInstanceWithProvider = typeof fastify

fastify.register(sensible)

// Simple header-based verification for sensitive endpoints. Accepts either:
// - x-verification-key: <key>
// - x-api-key: <key>
// - Authorization: Bearer <key>
const verifyKey = async (request: FastifyRequest, reply: FastifyReply) => {
    // Schema requires `x-verification-key`, so prefer only that header here to keep
    // validation and runtime checks consistent.
    const raw = request.headers['x-verification-key'] as string | undefined

    if (!raw) {
        throw fastify.httpErrors.unauthorized("Missing x-verification-key header")
    }

    if (VERIFICATION_KEY === undefined) {
        throw fastify.httpErrors.internalServerError("Server verification key not configured")
    }

    if (raw !== VERIFICATION_KEY) {
        throw fastify.httpErrors.forbidden("Invalid verification key")
    }
}

fastify.setErrorHandler((err: FastifyError, request, reply) => {
    const statusCode = err.statusCode ?? 500

    if (statusCode >= 500) {
        request.log.error({ err }, "request failed")
    } else {
        request.log.warn({ err }, "request rejected")
    }

    reply.code(statusCode).send({
        ok: false,
        error: {
            code: err.code ?? "ERR",
            message: err.message,
        },
    });
})

const routes = async (fastify : FastifyInstanceWithProvider) => {
    fastify.get('/api/health', async (request, reply) => {
        const r = await pool.query("select 1 as ok")
        return { ok: r.rows[0]?.ok === 1 }
    })

    fastify.post('/api/generate-sequence', { ...gsOpts, preHandler: verifyKey }, async (request, reply) => {
        const { 
            tov_config, 
            company_context, 
            sequence_length, 
            prospect_url 
        } = request.body

        // stub; real version would replace this with scraper
        const profileStub : ProspectStub = generateLinkedInProfileStub(prospect_url)

        const [insertedOrSelectedProspect, insertedOrSelectedTovConfig] = await Promise.all([
            insertProspectSelectOnConflict(profileStub),
            insertTovConfigSelectOnConflict(tov_config)
        ])

        const analysisPrompt = generateAnalysisPrompt(profileStub)

        const profileAnalysisResponse = await openAiClient.responses.create({
            model: "gpt-5-mini",
            input: [
                {
                    role: "system",
                    content: "You are expert at analyzing sales prospects with limited information"
                },
                {
                    role: "user",
                    content: analysisPrompt
                },
            ],
            reasoning: { effort: "medium" }
        })

        const profileAnalysisContent = profileAnalysisResponse.output
        const profileAnalysisContentAsText = profileAnalysisResponse.output_text

        if (!profileAnalysisContentAsText || profileAnalysisContentAsText.trim() === "") {
            throw fastify.httpErrors.badGateway("OpenAI returned no analysis text")
        }

        // endpoint validates bounds on TOV config so we shouldn't be
        // inserting invalid data into db- should 400 before then but cover this jic

        // generate prompt
        const sequencePrompt = generateSequencePrompt(
            company_context, 
            profileStub,
            profileAnalysisContentAsText,
            tov_config,
            sequence_length
        )

        const generateSequenceResponse = await openAiClient.responses.parse({
            model: "gpt-5-mini",
            input: [
                {
                    role: "system",
                    content: "You are an expert outbound sales copywriter"
                },
                {
                    role: "user",
                    content: sequencePrompt
                }
            ],
            reasoning: { effort: "low" },
            text: {
                format: zodTextFormat(MessageSequenceJsonString, "MessageSequence")
            }
        })

        const fullModelName = generateSequenceResponse.model
        const sequenceGenerationResult = generateSequenceResponse.output_parsed

        if (!sequenceGenerationResult) {
            throw fastify.httpErrors.badGateway("OpenAI returned no parsed sequence")
        }

        if (!Array.isArray(sequenceGenerationResult.messages) || sequenceGenerationResult.messages.length === 0) {
            throw fastify.httpErrors.badGateway("OpenAI returned no parsed sequence")
        }

        if (sequenceGenerationResult.sequence_length !== sequence_length) {
            throw fastify.httpErrors.badGateway("Model sequence_length mismatch")
        }

        if (sequenceGenerationResult.messages.length !== sequence_length) {
            throw fastify.httpErrors.badGateway("Model returned wrong number of messages");
        }

        // if we fail any of these, we need to roll the database back- these are logically atomic
        await db.transaction(async (tx) => {
            const insertedSequence = await insertMessageSequence(tx, {
                prospect_id: insertedOrSelectedProspect[0].id,
                tov_config_id: insertedOrSelectedTovConfig[0].id,
                prospect_analysis: profileAnalysisContent,
                company_context: company_context,
                sequence_length: sequence_length
            })

            const withSequences = sequenceGenerationResult?.messages.map(msg => ({
                ...msg,
                message_sequence_id: insertedSequence[0].id
            }))

            let insertedMessagesArray = null;
            if (withSequences) {
                insertedMessagesArray = await insertMultipleMessages(tx, withSequences)
            }

            await Promise.all([
                insertAiGeneration(tx, {
                    sequence_id: insertedSequence[0].id,
                    provider: "OpenAI",
                    model: fullModelName,
                    prompt: sequencePrompt,
                    response: generateSequenceResponse,
                    generation_type: "message_generation",
                    token_usage: generateSequenceResponse.usage || null
                }),
                insertAiGeneration(tx, {
                    provider: "OpenAI",
                    // it's the same model on both
                    model: fullModelName,
                    prompt: analysisPrompt,
                    response: profileAnalysisResponse,
                    generation_type: "profile_analysis",
                    token_usage: profileAnalysisResponse.usage || null
                })
            ])
        })

        return reply.code(201).send({
            ok: true,
            profile_analysis_result: profileAnalysisContentAsText,
            sequence_generation_result: sequenceGenerationResult
        })
    })
}

fastify.register(routes)

export const runServer = async () => {
    try {
        await fastify.listen({ port: 3000 })
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}
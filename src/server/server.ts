import Fastify from "fastify"
import type { FastifyRequest, FastifyReply } from 'fastify'
import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts"
import { gsOpts } from "./schemas/generate-sequence.schema.js"
import { pool } from "../db/pool.js"
import { generateSequencePrompt } from "../lib/prompt-factories/sequence.js"
import generateLinkedInProfileStub from "../lib/helpers/linkedin-profile-stub.js"
import { upsertTovConfig, upsertProspect, insertMessageSequence, insertMultipleMessages, insertAiGeneration } from "../db/callbacks.js"
import { OPENAI_API_KEY, VERIFICATION_KEY } from "../config/env.js"
import { ProspectStub } from "../types/types.js"
import { parseOpenAiResponse } from "../lib/helpers/parse-openai-response.js"
import { ParsedApiResponse } from "../types/openai-response.types.js"

const fastify = Fastify({ logger: true }).withTypeProvider<JsonSchemaToTsProvider>()
type FastifyInstanceWithProvider = typeof fastify

// Simple header-based verification for sensitive endpoints. Accepts either:
// - x-verification-key: <key>
// - x-api-key: <key>
// - Authorization: Bearer <key>
const verifyKey = async (request: FastifyRequest, reply: FastifyReply) => {
    // Schema requires `x-verification-key`, so prefer only that header here to keep
    // validation and runtime checks consistent.
    const raw = request.headers['x-verification-key'] as string | undefined

    if (!raw) {
        void reply.code(401).send({ error: 'Missing x-verification-key header' })
        return
    }

    if (VERIFICATION_KEY === undefined) {
        void reply.code(500).send({ error: 'Server verification key not configured' })
        return
    }

    if (raw !== VERIFICATION_KEY) {
        void reply.code(403).send({ error: 'Invalid verification key' })
        return
    }
}

const routes = async (fastify : FastifyInstanceWithProvider) => {
    fastify.get('/health', async (request, reply) => {
        const r = await pool.query("select 1 as ok")
        return { ok: r.rows[0]?.ok === 1 }
    })

    fastify.post('/generate-sequence', { ...gsOpts, preHandler: verifyKey }, async (request, reply) => {
        const { 
            tov_config, 
            company_context, 
            sequence_length, 
            prospect_url 
        } = request.body

        const profileStub : ProspectStub = generateLinkedInProfileStub(prospect_url)

        // endpoint validates bounds on TOV config so we shouldn't be
        // inserting invalid data into db- should 400 before then but cover this jic

        const [upsertedProspect, upsertedTovConfig] = await Promise.all([
            upsertProspect(profileStub),
            upsertTovConfig(tov_config)
        ])

        // generate prompt
        const prompt = generateSequencePrompt(
            company_context, 
            profileStub,
            tov_config,
            sequence_length
        )

        const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-5-mini",
                reasoning: { effort: "low" },
                input: prompt,
                // ask the Responses API to return a structured JSON object
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "MessageSequence",
                        schema: {
                            type: "object",
                            properties: {
                                sequence_length: { type: "integer", minimum: 1 },
                                messages: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            step: { type: "integer", minimum: 1 },
                                            msg_content: { type: "string" },
                                            confidence: { type: "number", minimum: 0, maximum: 100 },
                                            rationale: { type: "string" },
                                            delay_days: { type: "integer", minimum: 0 }
                                        },
                                        required: ["step","msg_content","confidence","rationale","delay_days"],
                                        additionalProperties: false
                                    }
                                }
                            },
                            required: ["sequence_length","messages"],
                            additionalProperties: false
                        }
                    }
                }
            })
        })
        
        if (openAiResponse.status !== 200) {
            console.log("----OPENAI ERROR-----")
            console.log(openAiResponse.status)
            return {
                status: openAiResponse.status
            }
        }

        const sequenceGenerationResult : ParsedApiResponse = await parseOpenAiResponse(openAiResponse)

        const insertedSequence = await insertMessageSequence({
            prospect_id: upsertedProspect[0].id,
            tov_config_id: upsertedTovConfig[0].id,
            company_context: company_context,
            sequence_length: sequence_length
        })

        let insertedMessagesArray = null;
        if (sequenceGenerationResult.generatedContent && sequenceGenerationResult.generatedContent.messages) {
            const withSequences = sequenceGenerationResult.generatedContent.messages.map(msg => ({ 
                ...msg, 
                message_sequence_id: insertedSequence[0].id 
            }))
            insertedMessagesArray = await insertMultipleMessages(withSequences)
        }

        console.log("------ TEXT RESPONSE AS JSON ------")
        console.log(JSON.stringify(sequenceGenerationResult.generatedContent, null, 2))

        console.log("------ USAGE RESPONSE ------")
        console.log(JSON.stringify(sequenceGenerationResult.usage, null, 2))

        // insert message sequence
        return { 
            openai_api_response: sequenceGenerationResult
        }
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
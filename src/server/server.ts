import Fastify from "fastify"
import type { FastifyRequest, FastifyReply } from 'fastify'
import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts"
import { gsOpts } from "./schemas/generate-sequence.schema.js"
import { pool } from "../db/pool.js"
import { generateSequencePrompt } from "../lib/prompt-factories/sequence.js"
import generateLinkedInProfileStub, { ProspectStub } from "../lib/linkedin-profile-stub.js"
import { upsertTovConfig, upsertProspect } from "../db/callbacks.js"
import { OPENAI_API_KEY, VERIFICATION_KEY } from "../config/env.js"
import OpenAIResponse, { OutputItem } from "./schemas/openai-response.schema.js"
import { text } from "node:stream/consumers"

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

    fastify.post('/generate-sequence-dummy', async (request, reply) => {
        const { 
            tov_config, 
            company_context, 
            sequence_length, 
            prospect_url 
        } = request.body as any

        const profileStub : ProspectStub = generateLinkedInProfileStub(prospect_url)

        const prompt = generateSequencePrompt(
            company_context, 
            profileStub,
            tov_config,
            sequence_length
        )

        return {
            message: prompt
        }
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

        // const [upsertedProfile, upsertedTovConfig] = await Promise.all([
        //     upsertProspect(profileStub),
        //     upsertTovConfig(tov_config)
        // ])

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
                "model": "gpt-5-mini",
                "reasoning": { "effort": "low" },
                "input": prompt
            })
        }) 

        const openAiResponseBody: OpenAIResponse = await openAiResponse.json()

        const responseMessages : OutputItem[] = openAiResponseBody.output.filter((o: OutputItem) => o.type === "message")

        const textResponse = responseMessages[0].content?.[0].text
        const textResponseAsJson = textResponse ? JSON.parse(textResponse) : null

        console.log(JSON.stringify(textResponseAsJson, null, 2))

        console.log(JSON.stringify(openAiResponseBody.usage, null, 2))

        // note: make a decision on whether it's best to do tov_configs as enum or smallint (both?)

        /*
        create full response schema
        add to prompt the meaning of different step numbers
        send prompt with full response schema to openai api
        parse response and write the following
         - to message sequences
             - create new sequence with:
                 - prospect_id (select on insert w orm)
                 - tov_config_id (select on insert w orm)
                 - company_context (from request)
                 - prospect_analysis (figure out how to do this- probably a call)
                 - sequence_length (from request)
        
        parse the generated message sequence and write the following
         - to messages
            - sequence id (select on insert w orm)
            - step (from model response)
            - msg_content (from model response)
            - confidence (from model response)
            - rationale

        taking the in-memory responses write to ai_generations
            - sequence_id
            - provider (name of the AI)
            - model (name of the model)
            - prompt (prompt variable)
            - response (full model response)
            - generation_type
            - token_usage (should be given in response)
            - cost_usd (should be given)

        DO NOT BLOCK HERE i.e., do not await the result
        
        */

        return { 
            openai_api_response: openAiResponseBody
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
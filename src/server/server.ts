import Fastify from "fastify"
import type { FastifyPluginAsync } from "fastify"
import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts"
import { gsOpts } from "./schemas/generate-sequence.schema.js"
import { pool } from "../db/pool.js"
import { generateSequencePrompt } from "../lib/prompt-factories/sequence.js"
import generateLinkedInProfileStub, { ProspectStub } from "../lib/linkedin-profile-stub.js"

const fastify = Fastify({ logger: true }).withTypeProvider<JsonSchemaToTsProvider>()
type FastifyInstanceWithProvider = typeof fastify

const routes = async (fastify : FastifyInstanceWithProvider) => {
    fastify.get('/health', async (request, reply) => {
        const r = await pool.query("select 1 as ok")
        return { ok: r.rows[0]?.ok === 1 }
    })

    fastify.post('/generate-sequence', gsOpts, async (request, reply) => {
        const { 
            tov_config, 
            company_context, 
            sequence_length, 
            prospect_url 
        } = request.body

        console.log(JSON.stringify(tov_config))

        const profileStub : ProspectStub = generateLinkedInProfileStub(prospect_url)

        // write to database:
        //  - id, linkedin_url, fname, middle_initial, lname, headline, profile_data
        // upsert here

        const prompt = generateSequencePrompt(
            company_context, 
            profileStub,
            tov_config,
            sequence_length
        )

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
            message: prompt
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
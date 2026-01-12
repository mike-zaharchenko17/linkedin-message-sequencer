import Fastify from "fastify"
import type { FastifyPluginAsync } from "fastify"
import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts"
import { gsOpts } from "./schemas/generate-sequence.schema.js"
import { pool } from "../db/pool.js"
import { generateSequencePromptFactory } from "../lib/prompt-factories/sequence.js"
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

        const prompt = generateSequencePromptFactory(
            company_context, 
            profileStub,
            tov_config,
            sequence_length
        )

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
import Fastify from "fastify"
import type { FastifyPluginAsync } from "fastify"
import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts"
import { gsOpts } from "./schemas/generate-sequence.schema.js"
import { pool } from "../db/pool.js"

const fastify = Fastify({ logger: true }).withTypeProvider<JsonSchemaToTsProvider>()
type FastifyInstanceWithProvider = typeof fastify

const routes = async (fastify : FastifyInstanceWithProvider) => {
    fastify.get('/health', async (request, reply) => {
        const r = await pool.query("select 1 as ok")
        return { ok: r.rows[0]?.ok === 1 }
    })

    fastify.post('/generate-sequence', gsOpts, async (request, reply) => {
        const { tov_config, company_context, sequence_length, prospect_url } = request.body
        return { tov_config, company_context, sequence_length, prospect_url }
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
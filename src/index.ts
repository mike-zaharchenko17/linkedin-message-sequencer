import "dotenv/config"
import Fastify from 'fastify'
import { health } from './routes/health.js'

const fastify = Fastify({
    logger: true
})

fastify.get('/', async (request, reply) => {
    return { hello: "world" }
})

fastify.get('/health', health)

const start = async () => {
    try {
        await fastify.listen({ port: 3000 })
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}

start()
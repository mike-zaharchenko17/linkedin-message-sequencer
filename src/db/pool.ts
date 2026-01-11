import { Pool } from "pg";
import { DATABASE_URL } from "../config/env.js";

export const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
})

pool.on("error", (err) => {
    console.error("Unexpected PG pool error: ", err)
})
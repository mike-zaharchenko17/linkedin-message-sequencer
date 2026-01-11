import { pool } from "../db/pool.js"

export async function health() {
    const r = await pool.query("select 1 as ok")
    return { ok: r.rows[0]?.ok === 1}
}
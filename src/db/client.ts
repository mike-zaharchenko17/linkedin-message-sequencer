import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "./pool.js"

export const db = drizzle(pool)

export type Db = typeof db
export type Tx = Parameters<Db["transaction"]>[0] extends (tx: infer T, ...args: any) => any
  ? T
  : never;

export type DbConn = Db | Tx;
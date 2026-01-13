import { AiGeneration, Message, MessageSequence, ProspectStub, TovConfig } from "./types.js";
import { db, DbConn } from "./client.js";
import { eq, and } from "drizzle-orm"
import { message_sequences, prospects, tov_configs, messages, ai_generations } from "./schema.js";

export const insertProspectSelectOnConflict = async (p: ProspectStub) => {
    const insertedData = await db
        .insert(prospects)
        .values({ 
            linkedin_url: p.linkedin_url,
            fname: p.fname,
            middle_initial: p.middle_initial,
            lname: p.lname,
            headline: p.headline,
            profile_data: p.profile_data
        })
        .onConflictDoNothing()
        .returning()
    
    if (!insertedData[0]) {
        return await db
            .select()
            .from(prospects)
            .where(eq(prospects.linkedin_url, p.linkedin_url))
    }
    
    return insertedData
}

export const insertTovConfigSelectOnConflict = async (t: TovConfig) => {
    const insertedData = await db
        .insert(tov_configs)
        .values({
            formality: t.formality * 100,
            warmth: t.warmth * 100,
            directness: t.directness * 100
        })
        .onConflictDoNothing()
        .returning()

    if (!insertedData[0]) {
        return await db
            .select()
            .from(tov_configs)
            .where(and(
                eq(tov_configs.formality, t.formality * 100),
                eq(tov_configs.warmth, t.warmth * 100),
                eq(tov_configs.directness, t.directness * 100)
            )
        )
    }

    return insertedData
}

export const insertMessageSequence = async (conn: DbConn, ms: MessageSequence) => {
    const insertedData = await conn
        .insert(message_sequences)
        .values(ms)
        .returning()

    return insertedData
}

export const insertMessage = async (conn: DbConn, m: Message) => {
    const insertedData = await conn
        .insert(messages)
        .values(m)
        .returning()
    
    return insertedData
}

export const insertMultipleMessages = async (conn: DbConn, m: Message[]) => {
    const insertedData = await conn
        .insert(messages)
        .values(m)
        .returning()
    
    return insertedData
}

export const insertAiGeneration = async (conn: DbConn, a: AiGeneration) => {
    const insertedData = await conn
        .insert(ai_generations)
        .values(a)
        .returning()

    return insertedData
}



import { AiGeneration, Message, MessageSequence, ProspectStub, TovConfig } from "../types/types.js";
import { db } from "./client.js";
import { message_sequences, prospects, tov_configs, messages, ai_generations } from "./schema.js";

export const upsertProspect = async (p: ProspectStub) => {
    const upsertedData = await db
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
    
    return upsertedData
}

export const upsertTovConfig = async (t: TovConfig) => {
    const upsertedData = await db
        .insert(tov_configs)
        .values({
            formality: t.formality * 100,
            warmth: t.warmth * 100,
            directness: t.directness * 100
        })
        .onConflictDoNothing()
        .returning()

    return upsertedData
}

export const insertMessageSequence = async (ms: MessageSequence) => {
    const insertedData = await db
        .insert(message_sequences)
        .values(ms)
        .returning()

    return insertedData
}

export const insertMessage = async (m: Message) => {
    const insertedData = await db
        .insert(messages)
        .values(m)
        .returning()
    
    return insertedData
}

export const insertMultipleMessages = async (m: Message[]) => {
    const insertedData = await db
        .insert(messages)
        .values(m)
        .returning()
    
    return insertedData
}

export const insertAiGeneration = async (a: AiGeneration) => {
    const insertedData = await db
        .insert(ai_generations)
        .values(a)
        .returning()

    return insertedData
}



import { ProspectStub } from "../lib/linkedin-profile-stub.js";
import { db } from "./client.js";
import { prospects } from "./schema.js";

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


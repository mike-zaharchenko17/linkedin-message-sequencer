import { TovConfig, encodeTov } from "../encode-tov.js"
import { ProspectStub } from "../linkedin-profile-stub.js"

export function generateSequencePrompt(
    companyCtx: string,
    profileSnapshot: ProspectStub,
    tovConfig: TovConfig,
    sequenceLength: number,
) : string {
    const [formality, warmth, directness] = encodeTov(tovConfig)

    const prompt = `
    SYSTEM:
    You are an expert outbound sales copywriter.

    USER:
    Company context: ${companyCtx}

    Prospect profile:
    ${JSON.stringify(profileSnapshot)}

    Tone of voice:
    ${formality}
    ${warmth}
    ${directness}

    Task:
    Generate a ${sequenceLength}-step LinkedIn message sequence.
    Return JSON matching this schema: ...
    `

    return prompt
}
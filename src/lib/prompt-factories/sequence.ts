import { TovConfig, encodeTov } from "../encode-tov.js"

interface ProfileSnapshot {
    foo: string,
    bar: string
}

export function generateSequenceFactory(
    companyCtx: string,
    profileSnapshot: ProfileSnapshot,
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
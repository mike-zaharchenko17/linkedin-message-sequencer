import { encodeTov } from "../../lib/encode-tov.js"
import { TovConfig, ProspectStub } from "../../db/types.js"

export function generateSequencePrompt(
    companyCtx: string,
    profileSnapshot: ProspectStub,
    profileAnalysisContent: string,
    tovConfig: TovConfig,
    sequenceLength: number,
) : string {
    const [formality, warmth, directness] = encodeTov(tovConfig)

    const prompt = `
    Company context: ${companyCtx}

    PROSPECT PROFILE (JSON):
    ${JSON.stringify(profileSnapshot)}

    PROSPECT PROFILE ANALYSIS (LLM-GENERATED):
    ${JSON.stringify(profileAnalysisContent)}

    TONE OF VOICE:
    ${formality}
    ${warmth}
    ${directness}

    TASK:
    Generate a ${sequenceLength}-step LinkedIn message sequence that follows a fixed unhappy-path. Let N represent the length of the sequence.
    - Step 1 (Day 0): COLLECT request note (no pitch, no links)
    - Steps 2...(N-1): FOLLOW UP messages that add a new angle each time
    - Step N (Day X): BREAKUP message (polite close)

    You will decide the cadence of the messaging sequence

    CADENCE RULES:
    - Include "delay_days" for each step.
    - Use this default cadence as a baseline: [0, 2, 5, 9, 14].
    - If N < 5, take the first (N-1) offsets from [0,2,5,9] and always end with breakup at 14 (or the last available offset if you must).
    - If N > 5, keep Day 0 and Day 14, and evenly distribute the extra follow-ups between 2 and 13 (integers, strictly increasing).  

    MESSAGE RULES:
    - Each message <= 400 characters.
    - No links anywhere (interview take-home).
    - No “just bumping this” / “circling back” filler.
    - Each follow-up must introduce ONE new angle (choose from: pain, insight, proof, question, objection-handling, offer-resource).
    - Ask at most one question per message.
    - Do not invent facts not in the profile/company context; if something is unclear from context, fall back to safe filler
    - For every message, provide a confidence score (1-100) that conveys how confident you (the model) are that you had enough concrete personalization signals to write this message.
    - For every message, provide 1-2 sentences of rationale for why you are structuring this message the way you are

    Return only valid JSON, do not include any explanatory text or unescaped newlines; escape characters as required

    Return JSON matching this schema:

    {
        "sequence_length": number,
        "messages: [{
            "step": number,
            "msg_content": string,
            "confidence": number,
            "rationale": string,
            "delay_days": number
        }],
    }
    `

    return prompt
}
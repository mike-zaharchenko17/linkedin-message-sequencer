import { TovConfig } from "../../db/types.js"

function band(tovVal: number): "low" | "mid" | "high" {
    if (!Number.isFinite(tovVal)) throw new Error(`TOV value not finite: ${tovVal}`)
    // accept either 0..1 normalized values or 0..100 percentage values
    const v = tovVal > 1 ? tovVal / 100 : tovVal
    if (v < 0 || v > 1) throw new Error(`TOV value out of range 0..1 (got ${tovVal})`)
    if (v < 0.33) return "low"
    if (v < 0.66) return "mid"
    return "high"
}

const FORMALITY = {
    low: "Use casual language. Contractions and light informality are acceptable.",
    mid: "Use a professional but conversational tone.",
    high: "Use a formal, polished tone. Avoid slang and casual phrasing.",
}

const WARMTH = {
    low: "Keep emotional language minimal. Focus on facts and value.",
    mid: "Sound friendly and approachable without being overly personal.",
    high: "Use warm, personable language. Show genuine interest in the recipient.",
}

const DIRECTNESS = {
    low: "Avoid strong calls-to-action. Keep requests implicit.",
    mid: "Include a clear but low-pressure call-to-action.",
    high: "Be direct and explicit about the desired next step.",
}

export function encodeTov(
    tov: TovConfig
): Array<string> {
    return [
        FORMALITY[band(tov.formality)],
        WARMTH[band(tov.warmth)],
        DIRECTNESS[band(tov.directness)],
    ]
}




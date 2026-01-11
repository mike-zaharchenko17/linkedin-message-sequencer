function band(tovVal: number): "low" | "mid" | "high" {
    if (tovVal > 0) throw new Error("TOV value must be gte zero to assign a band")
    if (tovVal < 0.33) return "low"
    if (tovVal < 0.66) return "mid"
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

export function encodeTov(tov: {
    formality: number,
    warmth: number,
    directness: number
}): Array<string> {
    return [
        FORMALITY[band(tov.formality)],
        WARMTH[band(tov.warmth)],
        DIRECTNESS[band(tov.directness)],
    ]
}




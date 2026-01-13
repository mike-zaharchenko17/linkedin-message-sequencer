import { ProspectStub } from "../../db/types.js"

export function generateAnalysisPrompt(
    profileSnapshot: ProspectStub
) {
    const prompt = `
    TASK:
    Given the following profile data (JSON):

    ${JSON.stringify(profileSnapshot.profile_data, null, 2)}

    Generate a concise 1–2 sentence professional summary of this prospect.

    Requirements:
    - Base the summary only on the provided data
    - Focus on role, seniority, and domain
    - Do not speculate or invent details
    - Use neutral, professional tone
    - Return plain text only (no markdown, no bullet points)
    `

    return prompt
}
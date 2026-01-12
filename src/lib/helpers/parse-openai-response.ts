import { OpenAIResponse, OutputItem, ParsedApiResponse } from "../../types/openai-response.types.js";

// simple parser that extracts relevant fields from the API soup, formats 
// them for db insertion, and provides fallbacks if needed

export const parseOpenAiResponse = async (r: Response) : Promise<ParsedApiResponse> => {
    const openAiResponseBody: OpenAIResponse = await r.json()

    const responseMessages : OutputItem[] = openAiResponseBody.output.filter((o: OutputItem) => o.type === "message")

    const textResponse = responseMessages[0].content?.[0].text

    // this is a formatted string returned from the API as text so it needs to be parsed
    const generatedText = textResponse ? JSON.parse(textResponse) : null

    // runtime validation: ensure the model returned the expected MessageSequenceJsonString
    if (generatedText !== null) {
        const isObject = typeof generatedText === 'object' && generatedText !== null
        if (!isObject) throw new Error('Invalid model response: generatedContent is not an object')

        const { sequence_length, messages } = generatedText as any

        if (typeof sequence_length !== 'number' || !Number.isInteger(sequence_length) || sequence_length < 1) {
            throw new Error('Invalid model response: sequence_length missing or not a positive integer')
        }

        if (!Array.isArray(messages)) {
            throw new Error('Invalid model response: messages is missing or not an array')
        }

        // basic per-message validation
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i]
            if (typeof msg !== 'object' || msg === null) {
                throw new Error(`Invalid model response: message at index ${i} is not an object`)
            }

            if (typeof msg.step !== 'number' || !Number.isInteger(msg.step) || msg.step < 1) {
                throw new Error(`Invalid model response: message[${i}].step is missing or invalid`)
            }

            if (typeof msg.msg_content !== 'string') {
                throw new Error(`Invalid model response: message[${i}].msg_content is missing or not a string`)
            }

            if (typeof msg.confidence !== 'number' || msg.confidence < 0 || msg.confidence > 100) {
                throw new Error(`Invalid model response: message[${i}].confidence is missing or out of range`)
            }

            if (typeof msg.rationale !== 'string') {
                throw new Error(`Invalid model response: message[${i}].rationale is missing or not a string`)
            }

            if (typeof msg.delay_days !== 'number' || !Number.isInteger(msg.delay_days) || msg.delay_days < 0) {
                throw new Error(`Invalid model response: message[${i}].delay_days is missing or invalid`)
            }
        }

        if (messages.length !== sequence_length) {
            throw new Error('Invalid model response: messages.length does not match sequence_length')
        }
    }
    
    const { total_tokens, input_tokens, output_tokens } = openAiResponseBody.usage
    const usageStatistics = { total_tokens, input_tokens, output_tokens }

    const model = openAiResponseBody.model

    return {
        usage: usageStatistics,
        generatedContent: generatedText,
        model: model
    }
}
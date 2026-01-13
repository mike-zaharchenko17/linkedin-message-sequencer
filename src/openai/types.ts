import z from "zod"

export const MessageSequenceJsonString = z.object({
  sequence_length: z.number(),
  messages: z.array(z.object({
    step: z.number(),
    msg_content: z.string(),
    confidence: z.number(),
    rationale: z.string(),
    delay_days: z.number()
  }))
})
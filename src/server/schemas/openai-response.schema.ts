// Types generated from example OpenAI response JSON
export interface OpenAIResponse {
  id: string
  object: string
  created_at: number
  status: string
  background: boolean
  billing: Billing
  completed_at: number | null
  error: unknown | null
  frequency_penalty: number
  incomplete_details: unknown | null
  instructions: unknown | null
  max_output_tokens: number | null
  max_tool_calls: number | null
  model: string
  output: OutputItem[]
  parallel_tool_calls: boolean
  presence_penalty: number
  previous_response_id: string | null
  prompt_cache_key: string | null
  prompt_cache_retention: number | null
  reasoning: Reasoning | null
  safety_identifier: string | null
  service_tier: string
  store: boolean
  temperature: number
  text: ResponseText
  tool_choice: string
  tools: unknown[]
  top_logprobs: number | null
  top_p: number
  truncation: string
  usage: Usage
  user: string | null
  metadata: Record<string, unknown>
}

export interface Billing {
  payer: string
}

export interface OutputItem {
  id: string
  type: string
  // present for some items
  status?: string
  summary?: unknown[]
  content?: ContentItem[]
  role?: string
}

export interface ContentItem {
  type: string
  annotations: unknown[]
  logprobs: unknown[]
  text: string
}

export interface Reasoning {
  effort: string
  summary: string[] | null
}

export interface ResponseText {
  format: {
    type: string
  }
  verbosity: string
}

export interface Usage {
  input_tokens: number
  input_tokens_details: {
    cached_tokens: number
  }
  output_tokens: number
  output_tokens_details: {
    reasoning_tokens?: number
    // other output token detail fields may be present
    [k: string]: number | undefined
  }
  total_tokens: number
}

export default OpenAIResponse
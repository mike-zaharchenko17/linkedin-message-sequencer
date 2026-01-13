export type ProspectStub = {
	linkedin_url: string;
	fname: string;
	middle_initial?: string | null;
	lname: string;
	headline?: string | null;
	profile_data: Record<string, unknown>;
};

export interface TovConfig {
    formality: number,
    warmth: number,
    directness: number
}

export interface MessageSequence {
    prospect_id: string,
    tov_config_id: string,
    prospect_analysis: unknown,
    company_context: string,
    sequence_length: number
}

export interface Message {
    message_sequence_id: string,
    step: number,
    msg_content: string,
    confidence: number,
    rationale: string 
}

export interface AiGeneration {
    sequence_id?: string,
    provider: string,
    model: string,
    prompt: unknown,
    response: unknown,
    generation_type: string,
    token_usage: unknown,
}
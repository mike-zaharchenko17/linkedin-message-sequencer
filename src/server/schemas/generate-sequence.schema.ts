export const gsOpts = {
    schema: {
        body: {
            type: 'object',
            required: [
                'prospect_url', 
                'tov_config', 
                'company_context', 
                'sequence_length'
            ],
            properties: {
                prospect_url: { 
                    type: 'string',
                    format: 'uri', 
                },
                tov_config: { 
                    type: 'object',
                    required: ['formality', 'warmth', 'directness'],
                    properties: {
                        formality: { type: 'number' },
                        warmth: { type: 'number' },
                        directness: { type: 'number' },
                    },
                    additionalProperties: false,
                },
                company_context: { type: 'string' },
                sequence_length: { 
                    type: 'integer',
                    minimum: 1,
                    maximum: 5,
                },
            },
            additionalProperties: false
        }
    },
} as const
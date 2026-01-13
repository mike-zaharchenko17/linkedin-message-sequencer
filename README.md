## Stack

- Fastify
- Neon
- Drizzle ORM
- Render

## Project Structure

- migrations: contains sql files with database migrations
- src: project root; contains application entry point (index.ts)
  - config: contains environment variables
  - db: contains the database layer (connection pool, schemas, callbacks, etc.)
  - lib: contains helper functions and utils
  - openai: responsible for model connections, prompt engineering, and schema validation
    - prompt-factories: contains prompt builder functions
  - server: fastify core
- schemas: really just "schema" but contains the endpoint's payload validation module; additional schemas can be added here if this is expanded upon

## Database Structure

### General Decision Decisions

Insertions into message_sequences, messages, and ai_generations are performed atomically. If there is an error, the database will roll back. 

To accomplish this, I used drizzle's transaction wrappers. 

As these tables are very closely related to one another and hierarchical, I implemented it this way to ensure that every generation is accounted for and there are no orphaned entries. 

tov_configs and prospects are 'independent' of the aforementioned three, and are reliant on 'insert if not exists', so we don't treat them atomically. There is no rollback if these encounter an error. However, the API will still handle it and return a 500 status code.

### Schema 

**prospects**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PRIMARY KEY, default gen_random_uuid() | |
| linkedin_url | text | NOT NULL, UNIQUE | normalized URL
| fname | text | NOT NULL | first name
| middle_initial | text | NULL | optional
| lname | text | NOT NULL | last name
| headline | text | NULL | LinkedIn headline
| profile_data | jsonb | NOT NULL, DEFAULT '{}'::jsonb | snapshot of scraped profile
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

Purpose: normalized prospect records and a JSON snapshot of profile details used by prompts and analysis.

Design decisions:
- The prospects table contains normalized fields for data that can be found on every LinkedIn profile and uses jsonb to store "messy" data that can vary from profile to profile. In a more sophisticated system with scraping instead of stubbing, it would be prudent to build out a system that separates some of these fields into separate tables for more performant queries and analytics capability. 
- LinkedIn URL as a discriminator; since a profile url is inherently unique, uniqueness can be enforced and  

**tov_configs**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PRIMARY KEY, default gen_random_uuid() | |
| formality | smallint | NOT NULL, CHECK 0–100 | stored as 0–100
| warmth | smallint | NOT NULL, CHECK 0–100 | stored as 0–100
| directness | smallint | NOT NULL, CHECK 0–100 | stored as 0–100
| instructions | text | NULL | free-form TOV instructions
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

Purpose: tone-of-voice presets (formality/warmth/directness) used when generating sequences. Unique constraint on (formality, warmth, directness).

Design decisions: 
- To encourage deduplication and reuse, there is a unique constraint on the (formality, warmth, directness) triple in tov_configs
- By storing tov_configs in a separate table, we encourage data deduplication and make our configs more easily auditable than they would be if we were to inline them into message_sequences
- On write, the system attempts an insert and, if the unique constraint is violated, selects the relevant toi

**message_sequences**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PRIMARY KEY, default gen_random_uuid() | |
| prospect_id | uuid | NOT NULL, REFERENCES prospects(id) ON DELETE CASCADE | |
| tov_config_id | uuid | NOT NULL, REFERENCES tov_configs(id) | |
| company_context | text | NOT NULL | company's own context for generation
| prospect_analysis | jsonb | NOT NULL, DEFAULT '{}'::jsonb | LLM analysis snapshot
| sequence_length | int | NOT NULL | number of messages
| current_step | int | NOT NULL, DEFAULT 1 | next message to send
| response_received | boolean | NOT NULL, DEFAULT FALSE | lifecycle flag
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| last_sent_at | timestamptz | NULL | timestamp of last send

Purpose: top-level sequence object tying a prospect + TOV config + generated analysis together. Tracks lifecycle (current step, response received). The application does not currently have lifecycle update features, but the columns are there to make adding cron etc. seamless.

Design decisions:
- message_sequences was made to control the lifecycle of the messaging sequence. That is, messages are only aware of which step they are. They are not aware of which step the overall sequence is on. If we were to incorporate a cron module / scheduler, it would consult the message_sequences table to decide when to deploy follow up messages and make updates depending on status

**messages**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PRIMARY KEY, default gen_random_uuid() | |
| message_sequence_id | uuid | NOT NULL, REFERENCES message_sequences(id) ON DELETE CASCADE | |
| step | int | NOT NULL | message index (1..N)
| msg_content | text | NOT NULL | message body
| trigger_type | text | NOT NULL, DEFAULT 'no_response' | CHECK: 'no_response' \/ 'always_send' \/ 'manual'
| delay_days | int | NOT NULL, DEFAULT 2 | scheduling
| confidence | smallint | NOT NULL | 0–100
| rationale | text | NULL | optional explanation

Purpose: individual messages in a sequence. Each message has a trigger and scheduling metadata.

Design decisions: 
- Messages are aware of their trigger and how many days since the previous message need to have passed for them to be deployed. This allows us to have a natural, staggered cadence that the LLM can decide on. When a scheduler goes to deploy a new message, it can check that message's specific trigger to see whether it should be deployed or not.

**ai_generations**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PRIMARY KEY, default gen_random_uuid() | |
| sequence_id | uuid | REFERENCES message_sequences(id) | nullable by design; links generation to sequence
| provider | text | NOT NULL | e.g., OpenAI
| model | text | NOT NULL | model identifier
| prompt | jsonb | NOT NULL | stored prompt
| response | jsonb | NOT NULL | full response payload
| generation_type | text | NOT NULL | CHECK: 'profile_analysis' \/ 'message_generation'
| token_usage | jsonb | NULL | raw token usage object
| cost_usd | real | NULL | optional cost
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

Purpose: audit/log of AI calls (prompts, full responses, token usage & cost) so sequences and analysis can be audited or re-run.

### Prompt Engineering

I used a basic structure for prompt engineering: system-level meta instructions and user-level task instructions. In this system, a prompt is a template and has request-specific information dynamically inserted into it. 

Right now, the system is not response-aware and follows only the unhappy path (though I did add some extra trigger options should there be a need for easy improvements) where the prospect does not respond

Full prompt snapshots and configs are stored in the database for easier analytics and auditing.

### AI Integration and Error Handling

This project took me a while because, just as I was about to complete it, I stress tested it a few times, and got a malformed JSON error (fun reminder that LLMs are not deterministic). 

This led to me looking for a way to enforce structured output and an eventual refactor of the whole prompting and generation system (naked API call -> OpenAI SDK call with structured output enforcement and JSON schema validation)

By incorporating structured output with Fastify (and @fastify/sensible)'s error handling, the endpoint throws a bad gateway if the LLM's response:
- deviates from the expected schema
- deviates from sequence length parameters
- is improperly structured (missing escape characters, etc.)
- is empty
- has an explicit error

### API design choices and data validation

The endpoint is at `<base_url>/api/generate-sequence`

It takes the following request payload:

```[javascript]
POST /api/generate-sequence
{
  "prospect_url": "https://linkedin.com/in/john-doe",
  "tov_config": {
    "formality": 0.8,
    "warmth": 0.6, 
    "directness": 0.7
  },
  "company_context": "We help SaaS companies automate sales",
  "sequence_length": 3
}
```

There is also a db health endpoint that takes no payload and performs an empty query at `<base_url>/api/health`

The `generate-sequence` endpoint functions as an orchestrator. It coordinates the program's logical flow.

Payload validation is handled through Fastify's options. The expected payload schema is supplied in an options object. The endpoint it will reject with a 400 status code if the incoming body is malformed.

For general error handling, I registered an error handler with Fastify that returns structured, predictable, and explicit output. It covers gateway, internal, and permission errors.

**IMPORTANT:** to protect my OpenAI API usage, the endpoint will reject requests that do not have the correct x-verification-key set in the request's headers.

### Future Improvements ###

- Hook a actual system up to it (proper UI, scraper, and message scheduler/deployer). It would also be possible to make the system response-aware with streaming
- Improve the latency
  - Right now, it takes about 20s from request to response. I think it can be sped up by:
    - Experimenting with models and reasoning presets to see where latency can be minimized without compromising quality
    - Since the prompt is basically a skeleton, we can cache it to reduce both token usage and input processing time
    - Offloading database updates to a separate worker thread so that response time is bounded only by model response (though I suspect this to be the case anyway- db reads/writes are comparatively fast)
- Add more path coverage
  - Include the happy path as well


- Database schema decisions and why
- How you approached prompt engineering
- AI integration patterns and error handling
- API design choices and data validation
- What you'd improve with more time

## Stack

Fastify
Neon
Drizzle ORM
Render

## Project Structure

-> migrations: contains sql files with database migrations
-> src: project root; contains application entry point (index.ts)
---> config: contains environment variables
---> db: contains the database layer (connection pool, schemas, callbacks, etc.)
---> lib: contains helper functions and utils
---> openai: responsible for model connections, prompt engineering, and schema validation
-----> prompt-factories: contains prompt builder functions
---> server: fastify core
-----> schemas: really just "schema" but contains the endpoint's payload validation module; additional schemas can be added here if this is expanded upon

## Database Structure

Below is a concise reference of the production DB tables (mirrors the SQL in `migrations/`). Use this for quick orientation when working with the data model.

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





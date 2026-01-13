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

Managed Postgres instance on Neon

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




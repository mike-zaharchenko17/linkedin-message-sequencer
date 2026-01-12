create table if not exists tov_configs (
    id uuid primary key default gen_random_uuid(),
    formality smallint not null,
    warmth smallint not null,
    directness smallint not null,
    instructions text, 
    created_at timestamptz not null default now(),

    /* CONSTRAINTS */
    unique (formality, warmth, directness),
    check (formality between 0 and 100),
    check (warmth between 0 and 100),
    check (directness between 0 and 100)
);

create table if not exists message_sequences (
    /* RELATIONS */

    id uuid primary key default gen_random_uuid(),
    prospect_id uuid not null references prospects(id) on delete cascade,
    tov_config_id uuid not null references tov_configs(id),

    /* SEQUENCE CONTEXT */

    -- the messaging company's own context
    company_context text not null,          
    -- analysis of the linkedin profile provided by LLM
    prospect_analysis jsonb not null default '{}'::jsonb,
    sequence_length int not null,

    /* LIFECYCLE */

    -- which stage of the interaction are we in? 
    -- this is the next message to send and is incremented on message send
    current_step int not null default 1,
    -- if response received, stop sequence (if appropriate)
    response_received boolean not null default FALSE,
    created_at timestamptz not null default now(),
    last_sent_at timestamptz,

    /* CONSTRAINTS */
    check (sequence_length >= 1)
);

-- conditional messaging for scalability and control
-- to keep the scope of this assignment small, we are using only 'no_response'
create type if not exists trigger_types as enum ('no_response', 'always_send', 'manual');

create table if not exists messages (
    /* RELATIONS */

    id uuid primary key default gen_random_uuid(),
    message_sequence_id uuid not null references message_sequences(id) on delete cascade,

    /* LIFECYCLE */

    -- which stage of the interaction does this msg correspond to?
    step int not null,
    msg_content text not null,
    trigger_type trigger_types not null default 'no_response',
    delay_days int not null default 2,

    /* METADATA */
    confidence smallint not null,
    rationale text,

    /* CONSTRAINTS */
    unique (message_sequence_id, step),
    check (confidence between 0 and 100),
    check (delay_days >= 0),
    check (step >= 1)
);

create index if not exists idx_message_sequences_prospect_id on message_sequences(prospect_id);
create index if not exists idx_messages_message_sequence_id on messages(message_sequence_id);
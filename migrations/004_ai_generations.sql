-- per-sequence bookkeeping
create type if not exists gen_type as enum ('profile_analysis', 'message_generation');

create table if not exists ai_generations (
    id uuid primary key default gen_random_uuid(),
    sequence_id uuid references message_sequences(id) on delete cascade,
    provider text not null,
    model text not null,
    prompt jsonb not null,
    response jsonb not null,
    generation_type gen_type not null,
    token_usage jsonb,
    cost_usd real,
    created_at timestamptz not null default now()
);
create table if not exists prospects (
    id uuid primary key default gen_random_uuid(),
    -- normalized data
    linkedin_url text not null unique,
    fname text not null,
    middle_initial text,
    lname text not null,
    headline text,
    -- snapshot; source of truth
    profile_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
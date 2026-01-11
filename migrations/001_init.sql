create extension if not exists pgcrypto;

create index if not exists idx_ai_generations_sequence_id on ai_generations(sequence_id);
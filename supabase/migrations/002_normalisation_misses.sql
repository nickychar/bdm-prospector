-- supabase/migrations/002_normalisation_misses.sql

create table normalisation_misses (
  id         uuid primary key default gen_random_uuid(),
  board      text not null,
  raw_term   text not null,
  field      text not null check (field in ('contract_type','seniority')),
  created_at timestamptz default now()
);

create index on normalisation_misses (field, raw_term);

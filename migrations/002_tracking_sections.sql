alter table records add column if not exists tracking jsonb not null default '{}'::jsonb;
alter table records add column if not exists sections jsonb not null default '{}'::jsonb;
alter table records add column if not exists critical_misses jsonb not null default '[]'::jsonb;

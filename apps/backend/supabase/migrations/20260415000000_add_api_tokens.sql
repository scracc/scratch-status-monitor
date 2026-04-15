-- API Tokens Table
create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  is_active boolean not null default true,
  is_admin boolean not null default false,
  rate_limit_per_minute integer not null default 60 check (rate_limit_per_minute > 0),
  settings jsonb not null default '{}'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table api_tokens is 'Managed API tokens for backend authentication';
comment on column api_tokens.token_hash is 'SHA-256 hash of the raw token';
comment on column api_tokens.token_prefix is 'First visible characters of token for identification';
comment on column api_tokens.is_admin is 'Allows access to token management endpoints';
comment on column api_tokens.rate_limit_per_minute is 'Per-token request rate limit (fixed window, per minute)';
comment on column api_tokens.settings is 'Arbitrary per-token settings stored as JSON';

create index if not exists idx_api_tokens_active_expires on api_tokens (is_active, expires_at);
create index if not exists idx_api_tokens_last_used on api_tokens (last_used_at desc);

create or replace function update_api_tokens_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_api_tokens_updated_at on api_tokens;
create trigger trg_api_tokens_updated_at
  before update on api_tokens
  for each row
  execute function update_api_tokens_updated_at();

alter table api_tokens enable row level security;

create policy "service_role_full_access" on api_tokens
  using (true)
  with check (true);

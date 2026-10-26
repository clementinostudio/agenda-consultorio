-- Alvena: banco de dados na nuvem (Supabase)
-- ------------------------------------------
-- Duas tabelas:
--   perfis  -> uma linha por conta: nome, foto e as respostas das perguntas iniciais
--   itens   -> cada paciente, sessão, cobrança, gasto, conta da casa, caixinha... vira uma linha
--
-- Por que "itens" e não uma tabela para cada coisa? O app funciona primeiro no aparelho (abre e salva
-- sem internet) e manda para a nuvem só o que mudou, item por item. Assim dois aparelhos podem mexer
-- ao mesmo tempo sem um apagar o outro, e campos novos no app não precisam de mudança no banco.
--
-- Segurança: Row Level Security em tudo. Cada conta só enxerga e só mexe nas próprias linhas.

-- ---------- perfis ----------
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  dados jsonb not null default '{}'::jsonb,       -- perfil, foto, fundo, vidro...
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- itens ----------
create table if not exists public.itens (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  colecao text not null,                           -- patients, sessions, charges, pessoal.lanc, doc...
  id text not null,                                -- o mesmo id que o app usa
  dados jsonb,                                     -- o item inteiro (null quando apagado)
  apagado boolean not null default false,          -- apagar = marcar, para o outro aparelho saber que sumiu
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, colecao, id),
  constraint colecao_valida check (colecao ~ '^[a-z][a-zA-Z0-9_.]{0,40}$'),
  constraint id_valido check (length(id) between 1 and 200)
);
-- O app pergunta "o que mudou desde a última vez?": este índice deixa isso rápido
create index if not exists itens_mudancas on public.itens (user_id, atualizado_em);

-- A hora de cada mudança vem sempre do servidor (o relógio do celular pode estar errado)
create or replace function public.marcar_atualizado()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := clock_timestamp();
  if tg_op = 'UPDATE' then new.criado_em := old.criado_em; end if;
  return new;
end $$;

drop trigger if exists itens_atualizado on public.itens;
create trigger itens_atualizado before insert or update on public.itens
  for each row execute function public.marcar_atualizado();
drop trigger if exists perfis_atualizado on public.perfis;
create trigger perfis_atualizado before insert or update on public.perfis
  for each row execute function public.marcar_atualizado();

-- ---------- segurança (RLS) ----------
alter table public.perfis enable row level security;
alter table public.itens enable row level security;

drop policy if exists "perfil: ver o meu" on public.perfis;
drop policy if exists "perfil: criar o meu" on public.perfis;
drop policy if exists "perfil: mudar o meu" on public.perfis;
create policy "perfil: ver o meu" on public.perfis for select to authenticated using (id = (select auth.uid()));
create policy "perfil: criar o meu" on public.perfis for insert to authenticated with check (id = (select auth.uid()));
create policy "perfil: mudar o meu" on public.perfis for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "itens: ver os meus" on public.itens;
drop policy if exists "itens: criar os meus" on public.itens;
drop policy if exists "itens: mudar os meus" on public.itens;
drop policy if exists "itens: apagar os meus" on public.itens;
create policy "itens: ver os meus" on public.itens for select to authenticated using (user_id = (select auth.uid()));
create policy "itens: criar os meus" on public.itens for insert to authenticated with check (user_id = (select auth.uid()));
create policy "itens: mudar os meus" on public.itens for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "itens: apagar os meus" on public.itens for delete to authenticated using (user_id = (select auth.uid()));

-- Ninguém sem login mexe em nada
revoke all on public.perfis, public.itens from anon;
grant select, insert, update, delete on public.perfis, public.itens to authenticated;

-- ---------- conta nova ganha um perfil sozinha ----------
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, nome) values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists conta_criada on auth.users;
create trigger conta_criada after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------- excluir a própria conta (LGPD) ----------
-- Apaga o login e, em cascata, o perfil e todos os itens.
create or replace function public.excluir_minha_conta()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;

-- ---------- tempo real: o que muda no celular aparece no computador na hora ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'itens') then
    alter publication supabase_realtime add table public.itens;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'perfis') then
    alter publication supabase_realtime add table public.perfis;
  end if;
end $$;

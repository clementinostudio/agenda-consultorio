-- Dinheiro a dois (ou em família): uma "casa" com até 5 pessoas que veem e anotam os gastos da casa
-- ----------------------------------------------------------------------------------------------
--   casas         -> a casa (nome e quem criou)
--   casa_membros  -> quem está na casa (nome e foto que os outros veem; uma casa por pessoa)
--   casa_convites -> o link de convite (vale 7 dias; quem abre entra na casa)
--   casa_itens    -> os gastos da casa e os acertos, no mesmo jeito da tabela "itens"
--
-- Segurança: só quem é da casa enxerga e mexe nela. Os dados pessoais de cada um (tabela "itens")
-- continuam só da própria pessoa. Entrar, sair e convidar passam por funções que conferem tudo.

create table if not exists public.casas (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Nossa casa' check (length(nome) between 1 and 60),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create table if not exists public.casa_membros (
  casa_id uuid not null references public.casas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null default '' check (length(nome) <= 60),
  foto text check (foto is null or length(foto) <= 150000),
  papel text not null default 'membro' check (papel in ('dono', 'membro')),
  entrou_em timestamptz not null default now(),
  primary key (casa_id, user_id)
);
-- uma casa por pessoa (deixa tudo simples: "a minha casa")
create unique index if not exists casa_membros_uma_casa on public.casa_membros (user_id);

create table if not exists public.casa_convites (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  casa_id uuid not null references public.casas (id) on delete cascade,
  criado_por uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days'
);

create table if not exists public.casa_itens (
  casa_id uuid not null references public.casas (id) on delete cascade,
  colecao text not null,
  id text not null,
  dados jsonb,
  apagado boolean not null default false,
  por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (casa_id, colecao, id),
  constraint casa_colecao_valida check (colecao ~ '^[a-z][a-zA-Z0-9_.]{0,40}$'),
  constraint casa_id_valido check (length(id) between 1 and 200)
);
create index if not exists casa_itens_mudancas on public.casa_itens (casa_id, atualizado_em);
-- hora do servidor e quem mexeu por último (sempre quem está logado: ninguém se passa por outro)
create or replace function public.casa_marcar()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := clock_timestamp();
  new.por := auth.uid();
  if tg_op = 'UPDATE' then new.criado_em := old.criado_em; end if;
  return new;
end $$;
drop trigger if exists casa_itens_atualizado on public.casa_itens;
create trigger casa_itens_atualizado before insert or update on public.casa_itens
  for each row execute function public.casa_marcar();

-- Quem está logado é da casa? (security definer: não cai na própria regra da tabela de membros)
create or replace function public.sou_da_casa(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.casa_membros m where m.casa_id = c and m.user_id = auth.uid());
$$;

-- ---------- segurança (RLS) ----------
alter table public.casas enable row level security;
alter table public.casa_membros enable row level security;
alter table public.casa_convites enable row level security;
alter table public.casa_itens enable row level security;

drop policy if exists "casa: ver a minha" on public.casas;
drop policy if exists "casa: dono muda o nome" on public.casas;
create policy "casa: ver a minha" on public.casas for select to authenticated using (public.sou_da_casa(id));
create policy "casa: dono muda o nome" on public.casas for update to authenticated using (dono = (select auth.uid())) with check (dono = (select auth.uid()));

drop policy if exists "membros: ver os da minha casa" on public.casa_membros;
drop policy if exists "membros: mudar o meu nome e foto" on public.casa_membros;
create policy "membros: ver os da minha casa" on public.casa_membros for select to authenticated using (public.sou_da_casa(casa_id));
create policy "membros: mudar o meu nome e foto" on public.casa_membros for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "convites: ver os da minha casa" on public.casa_convites;
drop policy if exists "convites: criar na minha casa" on public.casa_convites;
drop policy if exists "convites: apagar os da minha casa" on public.casa_convites;
create policy "convites: ver os da minha casa" on public.casa_convites for select to authenticated using (public.sou_da_casa(casa_id));
create policy "convites: criar na minha casa" on public.casa_convites for insert to authenticated with check (public.sou_da_casa(casa_id) and criado_por = (select auth.uid()));
create policy "convites: apagar os da minha casa" on public.casa_convites for delete to authenticated using (public.sou_da_casa(casa_id));

drop policy if exists "casa_itens: ver" on public.casa_itens;
drop policy if exists "casa_itens: criar" on public.casa_itens;
drop policy if exists "casa_itens: mudar" on public.casa_itens;
create policy "casa_itens: ver" on public.casa_itens for select to authenticated using (public.sou_da_casa(casa_id));
-- qualquer pessoa da casa anota e corrige (apagar = marcar como apagado)
create policy "casa_itens: criar" on public.casa_itens for insert to authenticated with check (public.sou_da_casa(casa_id));
create policy "casa_itens: mudar" on public.casa_itens for update to authenticated using (public.sou_da_casa(casa_id)) with check (public.sou_da_casa(casa_id));

revoke all on public.casas, public.casa_membros, public.casa_convites, public.casa_itens from anon;
grant select, update on public.casas to authenticated;
grant select on public.casa_membros to authenticated;
grant update (nome, foto) on public.casa_membros to authenticated;   -- o resto (papel, casa) só pelas funções
grant select, insert, delete on public.casa_convites to authenticated;
grant select, insert, update on public.casa_itens to authenticated;

-- ---------- funções: criar, ver convite, entrar, sair, tirar alguém ----------
create or replace function public.criar_casa(p_nome text, p_meu_nome text, p_foto text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  if exists (select 1 from public.casa_membros where user_id = auth.uid()) then raise exception 'ja tem casa'; end if;
  insert into public.casas (nome, dono) values (coalesce(nullif(trim(p_nome), ''), 'Nossa casa'), auth.uid()) returning id into c;
  insert into public.casa_membros (casa_id, user_id, nome, foto, papel) values (c, auth.uid(), left(coalesce(p_meu_nome, ''), 60), p_foto, 'dono');
  return c;
end $$;

-- Antes de entrar: de quem é a casa (só o nome da casa, de quem convidou e quantas pessoas)
create or replace function public.ver_convite(p_token text)
returns table (casa text, convidou text, pessoas int, valido boolean) language sql stable security definer set search_path = '' as $$
  select c.nome, coalesce((select m.nome from public.casa_membros m where m.casa_id = c.id and m.user_id = v.criado_por), ''),
         (select count(*)::int from public.casa_membros m where m.casa_id = c.id), v.expira_em > now()
  from public.casa_convites v join public.casas c on c.id = v.casa_id where v.token = p_token;
$$;

create or replace function public.entrar_na_casa(p_token text, p_meu_nome text, p_foto text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  select * into v from public.casa_convites where token = p_token;
  if not found or v.expira_em < now() then raise exception 'convite invalido'; end if;
  if exists (select 1 from public.casa_membros where user_id = auth.uid() and casa_id = v.casa_id) then return v.casa_id; end if;
  if exists (select 1 from public.casa_membros where user_id = auth.uid()) then raise exception 'ja tem casa'; end if;
  if (select count(*) from public.casa_membros where casa_id = v.casa_id) >= 5 then raise exception 'casa cheia'; end if;
  insert into public.casa_membros (casa_id, user_id, nome, foto) values (v.casa_id, auth.uid(), left(coalesce(p_meu_nome, ''), 60), p_foto);
  return v.casa_id;
end $$;

-- Sair: se quem criou sai, a casa passa para quem entrou primeiro; se não sobra ninguém, a casa some
create or replace function public.sair_da_casa()
returns void language plpgsql security definer set search_path = '' as $$
declare c uuid; prox uuid;
begin
  select casa_id into c from public.casa_membros where user_id = auth.uid();
  if c is null then return; end if;
  delete from public.casa_membros where casa_id = c and user_id = auth.uid();
  select user_id into prox from public.casa_membros where casa_id = c order by entrou_em limit 1;
  if prox is null then delete from public.casas where id = c;
  elsif (select dono from public.casas where id = c) = auth.uid() then
    update public.casas set dono = prox where id = c;
    update public.casa_membros set papel = 'dono' where casa_id = c and user_id = prox;
  end if;
end $$;

create or replace function public.tirar_da_casa(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  select id into c from public.casas where dono = auth.uid();
  if c is null then raise exception 'so quem criou a casa'; end if;
  if p_user = auth.uid() then raise exception 'use sair'; end if;
  delete from public.casa_membros where casa_id = c and user_id = p_user;
end $$;

revoke all on function public.sou_da_casa(uuid), public.criar_casa(text, text, text), public.ver_convite(text),
  public.entrar_na_casa(text, text, text), public.sair_da_casa(), public.tirar_da_casa(uuid) from public, anon;
grant execute on function public.sou_da_casa(uuid), public.criar_casa(text, text, text), public.ver_convite(text),
  public.entrar_na_casa(text, text, text), public.sair_da_casa(), public.tirar_da_casa(uuid) to authenticated;

revoke execute on function public.casa_marcar() from public, anon, authenticated;

-- tempo real: o gasto que um anota aparece no celular do outro na hora
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'casa_itens') then
    alter publication supabase_realtime add table public.casa_itens;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'casa_membros') then
    alter publication supabase_realtime add table public.casa_membros;
  end if;
end $$;

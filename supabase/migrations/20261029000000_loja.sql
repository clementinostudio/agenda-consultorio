-- Loja: o caixa de uma loja pequena (doces, sorvete, salgados...) com a dona e quem ajuda
-- ----------------------------------------------------------------------------------------------
--   lojas         -> a loja (nome, quem é a dona e até quando a assinatura dela libera a equipe)
--   loja_membros  -> quem está na loja: a dona e os ajudantes (uma loja por pessoa)
--   loja_convites -> o link de convite para ajudante (vale 7 dias)
--   loja_itens    -> vendas, gastos, produtos, a lista do que falta, o caixa de cada dia...
--                    no mesmo jeito da tabela "casa_itens"; "dia" é a data do movimento (nulo nos cadastros)
--
-- Segurança: só quem é da loja enxerga e mexe nela. Os dados pessoais de cada um continuam só seus.
-- Esconder o lucro de um ajudante é coisa das telas (ele precisa ver as vendas para anotar e fechar o caixa).

create table if not exists public.lojas (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Minha loja' check (length(nome) between 1 and 60),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pro_ate date,
  criado_em timestamptz not null default now()
);

create table if not exists public.loja_membros (
  loja_id uuid not null references public.lojas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null default '' check (length(nome) <= 60),
  foto text check (foto is null or length(foto) <= 150000),
  papel text not null default 'ajudante' check (papel in ('dono', 'ajudante')),
  ve_lucro boolean not null default false,
  entrou_em timestamptz not null default now(),
  primary key (loja_id, user_id)
);
create unique index if not exists loja_membros_uma_loja on public.loja_membros (user_id);

create table if not exists public.loja_convites (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  loja_id uuid not null references public.lojas (id) on delete cascade,
  criado_por uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days'
);

create table if not exists public.loja_itens (
  loja_id uuid not null references public.lojas (id) on delete cascade,
  colecao text not null,
  id text not null,
  dia date,
  dados jsonb,
  apagado boolean not null default false,
  por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (loja_id, colecao, id),
  constraint loja_colecao_valida check (colecao ~ '^[a-z][a-zA-Z0-9_.]{0,40}$'),
  constraint loja_id_valido check (length(id) between 1 and 200)
);
create index if not exists loja_itens_mudancas on public.loja_itens (loja_id, atualizado_em);
create index if not exists loja_itens_dia on public.loja_itens (loja_id, dia);

create or replace function public.loja_marcar()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := clock_timestamp();
  new.por := auth.uid();
  if tg_op = 'UPDATE' then new.criado_em := old.criado_em; end if;
  return new;
end $$;
drop trigger if exists loja_itens_atualizado on public.loja_itens;
create trigger loja_itens_atualizado before insert or update on public.loja_itens
  for each row execute function public.loja_marcar();

create or replace function public.sou_da_loja(l uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.loja_membros m where m.loja_id = l and m.user_id = auth.uid());
$$;

-- ---------- segurança (RLS) ----------
alter table public.lojas enable row level security;
alter table public.loja_membros enable row level security;
alter table public.loja_convites enable row level security;
alter table public.loja_itens enable row level security;

drop policy if exists "loja: ver a minha" on public.lojas;
drop policy if exists "loja: dona muda" on public.lojas;
create policy "loja: ver a minha" on public.lojas for select to authenticated using (public.sou_da_loja(id));
create policy "loja: dona muda" on public.lojas for update to authenticated using (dono = (select auth.uid())) with check (dono = (select auth.uid()));

drop policy if exists "loja_membros: ver" on public.loja_membros;
drop policy if exists "loja_membros: mudar o meu nome e foto" on public.loja_membros;
create policy "loja_membros: ver" on public.loja_membros for select to authenticated using (public.sou_da_loja(loja_id));
create policy "loja_membros: mudar o meu nome e foto" on public.loja_membros for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- só a dona convida
drop policy if exists "loja_convites: ver" on public.loja_convites;
drop policy if exists "loja_convites: criar" on public.loja_convites;
drop policy if exists "loja_convites: apagar" on public.loja_convites;
create policy "loja_convites: ver" on public.loja_convites for select to authenticated using (public.sou_da_loja(loja_id));
create policy "loja_convites: criar" on public.loja_convites for insert to authenticated
  with check (criado_por = (select auth.uid()) and exists (select 1 from public.lojas l where l.id = loja_id and l.dono = (select auth.uid())));
create policy "loja_convites: apagar" on public.loja_convites for delete to authenticated using (public.sou_da_loja(loja_id));

drop policy if exists "loja_itens: ver" on public.loja_itens;
drop policy if exists "loja_itens: criar" on public.loja_itens;
drop policy if exists "loja_itens: mudar" on public.loja_itens;
create policy "loja_itens: ver" on public.loja_itens for select to authenticated using (public.sou_da_loja(loja_id));
create policy "loja_itens: criar" on public.loja_itens for insert to authenticated with check (public.sou_da_loja(loja_id));
create policy "loja_itens: mudar" on public.loja_itens for update to authenticated using (public.sou_da_loja(loja_id)) with check (public.sou_da_loja(loja_id));

revoke all on public.lojas, public.loja_membros, public.loja_convites, public.loja_itens from anon;
grant select on public.lojas to authenticated;
grant update (nome, pro_ate) on public.lojas to authenticated;
grant select on public.loja_membros to authenticated;
grant update (nome, foto) on public.loja_membros to authenticated;   -- papel e ve_lucro só pelas funções
grant select, insert, delete on public.loja_convites to authenticated;
grant select, insert, update on public.loja_itens to authenticated;

-- ---------- funções: criar, ver convite, entrar, sair, tirar alguém, deixar ver o lucro ----------
create or replace function public.criar_loja(p_nome text, p_meu_nome text, p_foto text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare l uuid;
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  if exists (select 1 from public.loja_membros where user_id = auth.uid()) then raise exception 'ja tem loja'; end if;
  insert into public.lojas (nome, dono) values (coalesce(nullif(trim(p_nome), ''), 'Minha loja'), auth.uid()) returning id into l;
  insert into public.loja_membros (loja_id, user_id, nome, foto, papel, ve_lucro) values (l, auth.uid(), left(coalesce(p_meu_nome, ''), 60), p_foto, 'dono', true);
  return l;
end $$;

create or replace function public.ver_convite_loja(p_token text)
returns table (loja text, convidou text, pessoas int, valido boolean) language sql stable security definer set search_path = '' as $$
  select l.nome, coalesce((select m.nome from public.loja_membros m where m.loja_id = l.id and m.user_id = v.criado_por), ''),
         (select count(*)::int from public.loja_membros m where m.loja_id = l.id), v.expira_em > now()
  from public.loja_convites v join public.lojas l on l.id = v.loja_id where v.token = p_token;
$$;

create or replace function public.entrar_na_loja(p_token text, p_meu_nome text, p_foto text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  select * into v from public.loja_convites where token = p_token;
  if not found or v.expira_em < now() then raise exception 'convite invalido'; end if;
  if exists (select 1 from public.loja_membros where user_id = auth.uid() and loja_id = v.loja_id) then return v.loja_id; end if;
  if exists (select 1 from public.loja_membros where user_id = auth.uid()) then raise exception 'ja tem loja'; end if;
  if (select count(*) from public.loja_membros where loja_id = v.loja_id) >= 6 then raise exception 'loja cheia'; end if;
  insert into public.loja_membros (loja_id, user_id, nome, foto) values (v.loja_id, auth.uid(), left(coalesce(p_meu_nome, ''), 60), p_foto);
  return v.loja_id;
end $$;

-- Sair: se a dona sai, a loja passa para quem entrou primeiro; se não sobra ninguém, a loja some
create or replace function public.sair_da_loja()
returns void language plpgsql security definer set search_path = '' as $$
declare l uuid; prox uuid;
begin
  select loja_id into l from public.loja_membros where user_id = auth.uid();
  if l is null then return; end if;
  delete from public.loja_membros where loja_id = l and user_id = auth.uid();
  select user_id into prox from public.loja_membros where loja_id = l order by entrou_em limit 1;
  if prox is null then delete from public.lojas where id = l;
  elsif (select dono from public.lojas where id = l) = auth.uid() then
    update public.lojas set dono = prox, pro_ate = null where id = l;
    update public.loja_membros set papel = 'dono', ve_lucro = true where loja_id = l and user_id = prox;
  end if;
end $$;

create or replace function public.tirar_da_loja(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare l uuid;
begin
  select id into l from public.lojas where dono = auth.uid();
  if l is null then raise exception 'so a dona'; end if;
  if p_user = auth.uid() then raise exception 'use sair'; end if;
  delete from public.loja_membros where loja_id = l and user_id = p_user;
end $$;

create or replace function public.loja_ve_lucro(p_user uuid, p_ve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare l uuid;
begin
  select id into l from public.lojas where dono = auth.uid();
  if l is null then raise exception 'so a dona'; end if;
  update public.loja_membros set ve_lucro = coalesce(p_ve, false) where loja_id = l and user_id = p_user and papel <> 'dono';
end $$;

-- Totais por dia (para os meses antigos, que o app não baixa inteiros): vendas, gastos e o resto
create or replace function public.loja_resumo(p_loja uuid, p_de date, p_ate date)
returns table (dia date, colecao text, total numeric, n int) language sql stable set search_path = '' as $$
  select i.dia, i.colecao,
         sum(coalesce(nullif(i.dados->>'total', '')::numeric, nullif(i.dados->>'valor', '')::numeric, 0)), count(*)::int
  from public.loja_itens i
  where i.loja_id = p_loja and not i.apagado and i.dia between p_de and p_ate and public.sou_da_loja(p_loja)
  group by i.dia, i.colecao;
$$;

revoke all on function public.sou_da_loja(uuid), public.criar_loja(text, text, text), public.ver_convite_loja(text),
  public.entrar_na_loja(text, text, text), public.sair_da_loja(), public.tirar_da_loja(uuid), public.loja_ve_lucro(uuid, boolean),
  public.loja_resumo(uuid, date, date) from public, anon;
grant execute on function public.sou_da_loja(uuid), public.criar_loja(text, text, text), public.ver_convite_loja(text),
  public.entrar_na_loja(text, text, text), public.sair_da_loja(), public.tirar_da_loja(uuid), public.loja_ve_lucro(uuid, boolean),
  public.loja_resumo(uuid, date, date) to authenticated;

revoke execute on function public.loja_marcar() from public, anon, authenticated;

-- tempo real: a venda que o ajudante anota aparece no celular da dona na hora
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'loja_itens') then
    alter publication supabase_realtime add table public.loja_itens;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'loja_membros') then
    alter publication supabase_realtime add table public.loja_membros;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lojas') then
    alter publication supabase_realtime add table public.lojas;
  end if;
end $$;

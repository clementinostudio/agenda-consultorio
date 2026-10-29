-- Painel do dono (app.avina.com.br/admin/)
-- ----------------------------------------
--   admins   -> quem pode abrir o painel (só o dono). Entra pelo ligar-admin.sh.
--   acessos  -> registro de acesso de cada conta: data e hora, IP, cidade aproximada e aparelho.
--               O Marco Civil da Internet (art. 15) manda guardar por 6 meses; depois disso some sozinho.
--               Não tem ligação com auth.users de propósito: excluir a conta não apaga o registro antes do prazo.
--
-- O painel só vê quantidades e dados da conta (e-mail, cadastro, último acesso, plano). Nunca o conteúdo:
-- nada de nome de paciente, anotação, gasto ou valor. Tudo passa por funções que conferem, a cada pedido,
-- se quem pede é admin E entrou com o código do app autenticador (verificação em 2 etapas, "aal2").

-- ---------- admins ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security; -- sem regra nenhuma: só as funções abaixo leem
revoke all on public.admins from anon, authenticated;

-- ---------- acessos ----------
create table if not exists public.acessos (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  quando timestamptz not null default now(),   -- quando começou
  ultimo timestamptz not null default now(),   -- o mesmo aparelho e IP voltando na mesma hora só atualiza aqui
  ip text check (length(ip) <= 64),
  cidade text check (length(cidade) <= 80),
  regiao text check (length(regiao) <= 80),
  pais text check (length(pais) <= 8),
  aparelho text check (length(aparelho) <= 300) -- o "user agent" do navegador
);
create index if not exists acessos_conta on public.acessos (user_id, ultimo desc);
create index if not exists acessos_quando on public.acessos (quando);
alter table public.acessos enable row level security;
revoke all on public.acessos from anon, authenticated;

-- O app chama ao abrir. O IP e o aparelho vêm dos cabeçalhos do pedido (a pessoa não escolhe);
-- a cidade vem do servidor de avisos (a Cloudflare sabe a cidade aproximada pelo IP).
create or replace function public.registrar_acesso(p_cidade text default null, p_regiao text default null, p_pais text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := auth.uid();
  h jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_ip text := nullif(trim(coalesce(h ->> 'cf-connecting-ip', h ->> 'x-real-ip', split_part(h ->> 'x-forwarded-for', ',', 1))), '');
  v_ap text := left(nullif(h ->> 'user-agent', ''), 300);
  v_id bigint;
begin
  if eu is null then raise exception 'sem login'; end if;
  begin v_ip := host(v_ip::inet); exception when others then v_ip := null; end;
  p_cidade := left(nullif(trim(p_cidade), ''), 80);
  p_regiao := left(nullif(trim(p_regiao), ''), 80);
  p_pais := left(nullif(trim(p_pais), ''), 8);

  -- o mesmo aparelho no mesmo IP há menos de 1 hora (ou já são muitos registros hoje): só atualiza o último
  select id into v_id from public.acessos
   where user_id = eu and ultimo > now() - interval '1 hour' and ip is not distinct from v_ip and aparelho is not distinct from v_ap
   order by ultimo desc limit 1;
  if v_id is null and (select count(*) from public.acessos where user_id = eu and quando > now() - interval '1 day') >= 60 then
    select id into v_id from public.acessos where user_id = eu order by ultimo desc limit 1;
  end if;

  if v_id is not null then
    update public.acessos set ultimo = now(), cidade = coalesce(p_cidade, cidade), regiao = coalesce(p_regiao, regiao), pais = coalesce(p_pais, pais)
     where id = v_id;
  else
    insert into public.acessos (user_id, ip, cidade, regiao, pais, aparelho) values (eu, v_ip, p_cidade, p_regiao, p_pais, v_ap);
  end if;

  -- 6 meses (e uma semana de folga) e acabou
  delete from public.acessos where quando < now() - interval '6 months 7 days';
end $$;
revoke all on function public.registrar_acesso(text, text, text) from public, anon;
grant execute on function public.registrar_acesso(text, text, text) to authenticated;

-- ---------- quem é admin ----------
-- Só vale com a verificação em 2 etapas feita nesta sessão
create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
     and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
$$;
revoke all on function public.eh_admin() from public, anon, authenticated;

-- Para a página do painel saber o que mostrar (entrar, pedir o código ou abrir). Só fala da própria conta.
create or replace function public.sou_admin()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'admin', exists (select 1 from public.admins where user_id = (select auth.uid())),
    'verificado', coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2')
$$;
revoke all on function public.sou_admin() from public, anon;
grant execute on function public.sou_admin() to authenticated;

-- ---------- painel: números gerais ----------
create or replace function public.admin_resumo()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.eh_admin() then raise exception 'só para o admin' using errcode = '42501'; end if;
  with
  hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  -- "usou o app": abriu (acessos), mudou alguma coisa (itens) ou entrou (login)
  ativ as (
    select user_id, ultimo as t from public.acessos where ultimo > now() - interval '31 days'
    union all select user_id, quando from public.acessos where quando > now() - interval '31 days'
    union all select user_id, atualizado_em from public.itens where atualizado_em > now() - interval '31 days'
    union all select id, last_sign_in_at from auth.users where last_sign_in_at > now() - interval '31 days'
  ),
  ativ_dia as (select distinct user_id, (t at time zone 'America/Sao_Paulo')::date as d from ativ),
  modos as (
    select (p.dados -> 'perfil') is not null as fez,
           coalesce(p.dados -> 'perfil' ->> 'consultorio', '') <> 'false' as c,
           coalesce(p.dados -> 'perfil' ->> 'loja', '') = 'true' as l,
           coalesce(p.dados -> 'perfil' ->> 'pessoal', '') <> 'false' as ps
      from public.perfis p
  )
  select jsonb_build_object(
    'contas', jsonb_build_object(
      'total', (select count(*) from auth.users),
      'hoje', (select count(*) from auth.users, hoje where (created_at at time zone 'America/Sao_Paulo')::date = hoje.d),
      'd7', (select count(*) from auth.users where created_at > now() - interval '7 days'),
      'd30', (select count(*) from auth.users where created_at > now() - interval '30 days'),
      'sem_perfil', (select count(*) from modos where not fez),
      'com_2etapas', (select count(distinct user_id) from auth.mfa_factors where status = 'verified')),
    'ativos', jsonb_build_object(
      'd1', (select count(distinct user_id) from ativ_dia, hoje where ativ_dia.d = hoje.d),
      'd7', (select count(distinct user_id) from ativ_dia, hoje where ativ_dia.d > hoje.d - 7),
      'd30', (select count(distinct user_id) from ativ_dia, hoje where ativ_dia.d > hoje.d - 30)),
    'cadastros_dia', (select jsonb_agg(jsonb_build_object('dia', g.d, 'n',
        (select count(*) from auth.users where (created_at at time zone 'America/Sao_Paulo')::date = g.d)) order by g.d)
      from hoje, generate_series(hoje.d - 59, hoje.d, interval '1 day') as s(x), lateral (select s.x::date as d) g),
    'ativos_dia', (select jsonb_agg(jsonb_build_object('dia', g.d, 'n',
        (select count(*) from ativ_dia where ativ_dia.d = g.d)) order by g.d)
      from hoje, generate_series(hoje.d - 29, hoje.d, interval '1 day') as s(x), lateral (select s.x::date as d) g),
    'modos', jsonb_build_object(
      'consultorio', (select count(*) from modos where fez and c),
      'pessoal', (select count(*) from modos where fez and (ps or (not c and not l))),
      'loja', (select count(*) from modos where fez and l)),
    'colecoes', (select coalesce(jsonb_agg(jsonb_build_object('colecao', colecao, 'itens', n, 'contas', contas) order by n desc), '[]'::jsonb)
      from (select colecao, count(*) as n, count(distinct user_id) as contas from public.itens
             where not apagado and colecao <> 'doc' group by colecao) x),
    'casas', jsonb_build_object('casas', (select count(*) from public.casas), 'pessoas', (select count(*) from public.casa_membros)),
    'lojas', jsonb_build_object('lojas', (select count(*) from public.lojas),
      'ajudantes', (select count(*) from public.loja_membros where papel = 'ajudante'),
      'itens', (select count(*) from public.loja_itens where not apagado)),
    'acessos', jsonb_build_object(
      'registros', (select count(*) from public.acessos),
      'd1', (select count(*) from public.acessos where ultimo > now() - interval '1 day'),
      'cidades', (select coalesce(jsonb_agg(jsonb_build_object('cidade', cidade, 'regiao', regiao, 'contas', n) order by n desc), '[]'::jsonb)
        from (select cidade, regiao, count(distinct user_id) as n from public.acessos
               where cidade is not null and ultimo > now() - interval '30 days' group by cidade, regiao order by n desc limit 15) c)),
    'gerado_em', now()
  ) into r;
  return r;
end $$;
revoke all on function public.admin_resumo() from public, anon;
grant execute on function public.admin_resumo() to authenticated;

-- ---------- painel: lista de contas ----------
-- Por conta: dados da conta, último acesso e QUANTOS itens tem em cada lista (nunca o que tem dentro)
create or replace function public.admin_usuarios()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.eh_admin() then raise exception 'só para o admin' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(u) order by u.criado_em desc), '[]'::jsonb) into r from (
    select au.id, au.email, coalesce(p.nome, '') as nome, au.created_at as criado_em, au.last_sign_in_at as ultimo_login,
           au.email_confirmed_at is not null as email_ok, au.banned_until as bloqueado_ate,
           coalesce(au.raw_app_meta_data ->> 'provider', 'email') as provedor,
           exists (select 1 from auth.mfa_factors f where f.user_id = au.id and f.status = 'verified') as dois_passos,
           exists (select 1 from public.admins ad where ad.user_id = au.id) as admin,
           (p.dados -> 'perfil') is not null as perfil_feito,
           p.dados -> 'perfil' ->> 'profissao' as profissao,
           p.dados -> 'perfil' ->> 'consultorio' as m_consultorio,
           p.dados -> 'perfil' ->> 'pessoal' as m_pessoal,
           p.dados -> 'perfil' ->> 'loja' as m_loja,
           a.ultimo as ultimo_acesso, a.ip, a.cidade, a.regiao, a.pais, a.aparelho,
           (select max(i.atualizado_em) from public.itens i where i.user_id = au.id) as ultima_mudanca,
           (select coalesce(jsonb_object_agg(colecao, n), '{}'::jsonb) from (
              select i.colecao, count(*) as n from public.itens i
               where i.user_id = au.id and not i.apagado and i.colecao <> 'doc' group by i.colecao) c) as contagem,
           (select c.nome from public.casa_membros m join public.casas c on c.id = m.casa_id where m.user_id = au.id limit 1) as casa,
           (select jsonb_build_object('nome', l.nome, 'papel', m.papel) from public.loja_membros m join public.lojas l on l.id = m.loja_id
             where m.user_id = au.id limit 1) as loja
      from auth.users au
      left join public.perfis p on p.id = au.id
      left join lateral (select x.ultimo, x.ip, x.cidade, x.regiao, x.pais, x.aparelho from public.acessos x
                          where x.user_id = au.id order by x.ultimo desc limit 1) a on true
  ) u;
  return r;
end $$;
revoke all on function public.admin_usuarios() from public, anon;
grant execute on function public.admin_usuarios() to authenticated;

-- ---------- painel: histórico de acessos de uma conta ----------
create or replace function public.admin_acessos(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.eh_admin() then raise exception 'só para o admin' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.ultimo desc), '[]'::jsonb) into r from (
    select quando, ultimo, ip, cidade, regiao, pais, aparelho from public.acessos
     where user_id = p_user order by ultimo desc limit 200) x;
  return r;
end $$;
revoke all on function public.admin_acessos(uuid) from public, anon;
grant execute on function public.admin_acessos(uuid) to authenticated;

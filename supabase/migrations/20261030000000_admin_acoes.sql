-- Painel do dono, parte 2: ações (bloquear, desconectar, excluir, dar admin), registro do que o admin fez,
-- números do banco, IPs repetidos entre contas e a operadora (rede) de cada acesso.
-- Tudo continua passando por public.eh_admin() (admin + verificação em 2 etapas) a cada pedido.

-- ---------- operadora / rede de cada acesso ----------
alter table public.acessos add column if not exists rede text check (length(rede) <= 120);

drop function if exists public.registrar_acesso(text, text, text);
create or replace function public.registrar_acesso(p_cidade text default null, p_regiao text default null, p_pais text default null, p_rede text default null)
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
  p_rede := left(nullif(trim(p_rede), ''), 120);

  -- o mesmo aparelho no mesmo IP há menos de 1 hora (ou já são muitos registros hoje): só atualiza o último
  select id into v_id from public.acessos
   where user_id = eu and ultimo > now() - interval '1 hour' and ip is not distinct from v_ip and aparelho is not distinct from v_ap
   order by ultimo desc limit 1;
  if v_id is null and (select count(*) from public.acessos where user_id = eu and quando > now() - interval '1 day') >= 60 then
    select id into v_id from public.acessos where user_id = eu order by ultimo desc limit 1;
  end if;

  if v_id is not null then
    update public.acessos set ultimo = now(), cidade = coalesce(p_cidade, cidade), regiao = coalesce(p_regiao, regiao),
           pais = coalesce(p_pais, pais), rede = coalesce(p_rede, rede)
     where id = v_id;
  else
    insert into public.acessos (user_id, ip, cidade, regiao, pais, rede, aparelho) values (eu, v_ip, p_cidade, p_regiao, p_pais, p_rede, v_ap);
  end if;

  -- 6 meses (e uma semana de folga) e acabou
  delete from public.acessos where quando < now() - interval '6 months 7 days';
end $$;
revoke all on function public.registrar_acesso(text, text, text, text) from public, anon;
grant execute on function public.registrar_acesso(text, text, text, text) to authenticated;

-- ---------- registro do que o admin fez ----------
create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  admin uuid,
  admin_email text,
  acao text not null check (length(acao) <= 60),
  alvo uuid,
  alvo_email text,          -- guardado na hora: a conta pode ser excluída depois
  detalhe jsonb
);
create index if not exists admin_log_quando on public.admin_log (quando desc);
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;

create or replace function public.exigir_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'só para o admin' using errcode = '42501'; end if;
end $$;
revoke all on function public.exigir_admin() from public, anon, authenticated;

-- O painel e o servidor de avisos anotam aqui o que fizeram (dar cortesia, criar código, mandar aviso...)
create or replace function public.admin_anotar(p_acao text, p_alvo uuid default null, p_detalhe jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  insert into public.admin_log (admin, admin_email, acao, alvo, alvo_email, detalhe)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), left(p_acao, 60), p_alvo,
          (select email from auth.users where id = p_alvo), p_detalhe);
end $$;
revoke all on function public.admin_anotar(text, uuid, jsonb) from public, anon;
grant execute on function public.admin_anotar(text, uuid, jsonb) to authenticated;

create or replace function public.admin_log_lista(p_limite int default 300)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.exigir_admin();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.quando desc), '[]'::jsonb) into r from (
    select quando, admin_email, acao, alvo, alvo_email, detalhe from public.admin_log
     order by quando desc limit least(greatest(p_limite, 1), 2000)) x;
  return r;
end $$;
revoke all on function public.admin_log_lista(int) from public, anon;
grant execute on function public.admin_log_lista(int) to authenticated;

-- Nenhuma ação vale contra a própria conta nem contra outro admin (tira o admin antes)
create or replace function public.alvo_permitido(p_user uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then raise exception 'conta não encontrada'; end if;
  if p_user = auth.uid() then raise exception 'não dá para fazer isso com a sua própria conta'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then raise exception 'essa conta é admin: tire o admin primeiro'; end if;
end $$;
revoke all on function public.alvo_permitido(uuid) from public, anon, authenticated;

-- ---------- ações ----------
-- Sai de todos os aparelhos (o acesso que já está aberto dura no máximo mais 1 hora)
create or replace function public.admin_desconectar(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  perform public.alvo_permitido(p_user);
  delete from auth.sessions where user_id = p_user;
  delete from auth.refresh_tokens where user_id = p_user::text;
  perform public.admin_anotar('desconectar', p_user, null);
end $$;
revoke all on function public.admin_desconectar(uuid) from public, anon;
grant execute on function public.admin_desconectar(uuid) to authenticated;

-- Bloqueia por alguns dias (p_dias > 0; 36500 = para sempre) ou desbloqueia (p_dias = 0 ou nulo)
create or replace function public.admin_bloquear(p_user uuid, p_dias int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  perform public.alvo_permitido(p_user);
  if coalesce(p_dias, 0) <= 0 then
    update auth.users set banned_until = null where id = p_user;
    perform public.admin_anotar('desbloquear', p_user, null);
  else
    update auth.users set banned_until = now() + make_interval(days => least(p_dias, 36500)) where id = p_user;
    delete from auth.sessions where user_id = p_user;
    delete from auth.refresh_tokens where user_id = p_user::text;
    perform public.admin_anotar('bloquear', p_user, jsonb_build_object('dias', p_dias));
  end if;
end $$;
revoke all on function public.admin_bloquear(uuid, int) from public, anon;
grant execute on function public.admin_bloquear(uuid, int) to authenticated;

-- Exclui a conta e tudo dela na nuvem (o mesmo que o "Excluir minha conta" do app).
-- A assinatura no Asaas e o que está no servidor de avisos quem cancela é o servidor (/admin/excluir), antes de chamar esta.
create or replace function public.admin_excluir_conta(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  perform public.alvo_permitido(p_user);
  perform public.admin_anotar('excluir conta', p_user, jsonb_build_object('nome', (select nome from public.perfis where id = p_user)));
  delete from auth.users where id = p_user;
end $$;
revoke all on function public.admin_excluir_conta(uuid) from public, anon;
grant execute on function public.admin_excluir_conta(uuid) to authenticated;

create or replace function public.admin_definir_admin(p_user uuid, p_sim boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_admin();
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'conta não encontrada'; end if;
  if p_user = auth.uid() and not p_sim then raise exception 'não dá para tirar o seu próprio admin'; end if;
  if p_sim then insert into public.admins (user_id) values (p_user) on conflict do nothing;
  else delete from public.admins where user_id = p_user; end if;
  perform public.admin_anotar(case when p_sim then 'dar admin' else 'tirar admin' end, p_user, null);
end $$;
revoke all on function public.admin_definir_admin(uuid, boolean) from public, anon;
grant execute on function public.admin_definir_admin(uuid, boolean) to authenticated;

-- ---------- acessos de todo mundo ----------
create or replace function public.admin_acessos_recentes(p_limite int default 400)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.exigir_admin();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.ultimo desc), '[]'::jsonb) into r from (
    select a.user_id, u.email, coalesce(p.nome, '') as nome, a.quando, a.ultimo, a.ip, a.rede, a.cidade, a.regiao, a.pais, a.aparelho
      from public.acessos a left join auth.users u on u.id = a.user_id left join public.perfis p on p.id = a.user_id
     order by a.ultimo desc limit least(greatest(p_limite, 1), 3000)) x;
  return r;
end $$;
revoke all on function public.admin_acessos_recentes(int) from public, anon;
grant execute on function public.admin_acessos_recentes(int) to authenticated;

-- IPs usados por mais de uma conta (mesma casa, mesma empresa... ou alguém criando contas para pegar código)
create or replace function public.admin_ips_repetidos(p_dias int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.exigir_admin();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.n desc, x.ultimo desc), '[]'::jsonb) into r from (
    select a.ip, count(distinct a.user_id) as n, max(a.ultimo) as ultimo, max(a.rede) as rede, max(a.cidade) as cidade,
           jsonb_agg(distinct jsonb_build_object('id', a.user_id, 'email', u.email)) as contas
      from public.acessos a left join auth.users u on u.id = a.user_id
     where a.ip is not null and a.ultimo > now() - make_interval(days => greatest(p_dias, 1))
     group by a.ip having count(distinct a.user_id) > 1
     order by count(distinct a.user_id) desc limit 100) x;
  return r;
end $$;
revoke all on function public.admin_ips_repetidos(int) from public, anon;
grant execute on function public.admin_ips_repetidos(int) to authenticated;

-- ---------- números do banco (Supabase) ----------
create or replace function public.admin_sistema()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; v_storage jsonb := null;
begin
  perform public.exigir_admin();
  if to_regclass('storage.objects') is not null then
    execute $q$select jsonb_build_object('arquivos', count(*), 'bytes', coalesce(sum((metadata ->> 'size')::bigint), 0)) from storage.objects$q$ into v_storage;
  end if;
  select jsonb_build_object(
    'banco_bytes', pg_database_size(current_database()),
    'versao', current_setting('server_version'),
    'conexoes', (select count(*) from pg_stat_activity),
    'cache', (select round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) from pg_statio_user_tables),
    'tabelas', (select coalesce(jsonb_agg(jsonb_build_object('tabela', t.schemaname || '.' || t.relname, 'linhas', t.n_live_tup,
                  'bytes', pg_total_relation_size(t.relid)) order by pg_total_relation_size(t.relid) desc), '[]'::jsonb)
                  from pg_stat_all_tables t where t.schemaname = 'public' or (t.schemaname = 'auth' and t.relname in ('users', 'sessions', 'refresh_tokens', 'mfa_factors'))),
    'storage', v_storage,
    'contas_por_entrada', (select coalesce(jsonb_object_agg(p, n), '{}'::jsonb) from (
        select coalesce(raw_app_meta_data ->> 'provider', 'email') as p, count(*) as n from auth.users group by 1) x),
    'sessoes_abertas', (select count(*) from auth.sessions),
    'bloqueadas', (select count(*) from auth.users where banned_until > now()),
    'gerado_em', now()
  ) into r;
  return r;
end $$;
revoke all on function public.admin_sistema() from public, anon;
grant execute on function public.admin_sistema() to authenticated;

-- ---------- lista de contas: + rede, quantos IPs e acessos nos últimos 30 dias, cidade do perfil ----------
create or replace function public.admin_usuarios()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.exigir_admin();
  select coalesce(jsonb_agg(to_jsonb(u) order by u.criado_em desc), '[]'::jsonb) into r from (
    select au.id, au.email, coalesce(p.nome, '') as nome, au.created_at as criado_em, au.last_sign_in_at as ultimo_login,
           au.email_confirmed_at is not null as email_ok, au.banned_until as bloqueado_ate,
           coalesce(au.raw_app_meta_data ->> 'provider', 'email') as provedor,
           exists (select 1 from auth.mfa_factors f where f.user_id = au.id and f.status = 'verified') as dois_passos,
           exists (select 1 from public.admins ad where ad.user_id = au.id) as admin,
           (select count(*) from auth.sessions s where s.user_id = au.id) as sessoes,
           (p.dados -> 'perfil') is not null as perfil_feito,
           p.dados -> 'perfil' ->> 'profissao' as profissao,
           p.dados -> 'perfil' ->> 'cidade' as cidade_perfil,
           p.dados -> 'perfil' ->> 'consultorio' as m_consultorio,
           p.dados -> 'perfil' ->> 'pessoal' as m_pessoal,
           p.dados -> 'perfil' ->> 'loja' as m_loja,
           a.ultimo as ultimo_acesso, a.ip, a.rede, a.cidade, a.regiao, a.pais, a.aparelho,
           (select count(distinct x.ip) from public.acessos x where x.user_id = au.id and x.ultimo > now() - interval '30 days') as ips_30d,
           (select count(*) from public.acessos x where x.user_id = au.id and x.ultimo > now() - interval '30 days') as acessos_30d,
           (select min(x.quando) from public.acessos x where x.user_id = au.id) as primeiro_acesso,
           (select max(i.atualizado_em) from public.itens i where i.user_id = au.id) as ultima_mudanca,
           (select coalesce(jsonb_object_agg(colecao, n), '{}'::jsonb) from (
              select i.colecao, count(*) as n from public.itens i
               where i.user_id = au.id and not i.apagado and i.colecao <> 'doc' group by i.colecao) c) as contagem,
           (select c.nome from public.casa_membros m join public.casas c on c.id = m.casa_id where m.user_id = au.id limit 1) as casa,
           (select jsonb_build_object('nome', l.nome, 'papel', m.papel) from public.loja_membros m join public.lojas l on l.id = m.loja_id
             where m.user_id = au.id limit 1) as loja
      from auth.users au
      left join public.perfis p on p.id = au.id
      left join lateral (select x.ultimo, x.ip, x.rede, x.cidade, x.regiao, x.pais, x.aparelho from public.acessos x
                          where x.user_id = au.id order by x.ultimo desc limit 1) a on true
  ) u;
  return r;
end $$;

create or replace function public.admin_acessos(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.exigir_admin();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.ultimo desc), '[]'::jsonb) into r from (
    select quando, ultimo, ip, rede, cidade, regiao, pais, aparelho from public.acessos
     where user_id = p_user order by ultimo desc limit 300) x;
  return r;
end $$;

-- ---------- números gerais: + funil (cadastrou → terminou o cadastro → voltou outro dia → usou nos últimos 7 dias) ----------
create or replace function public.admin_funil()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.exigir_admin();
  with uso as (
    select user_id, t from (
      select user_id, ultimo as t from public.acessos
      union all select user_id, atualizado_em from public.itens
      union all select id, last_sign_in_at from auth.users where last_sign_in_at is not null) x
  ),
  c as (
    select u.id, u.created_at,
           (p.dados -> 'perfil') is not null as perfil,
           exists (select 1 from uso where uso.user_id = u.id and uso.t > u.created_at + interval '1 day') as voltou,
           exists (select 1 from uso where uso.user_id = u.id and uso.t > now() - interval '7 days') as ativo7
      from auth.users u left join public.perfis p on p.id = u.id
  )
  select jsonb_build_object(
    'contas', (select count(*) from c),
    'perfil', (select count(*) from c where perfil),
    'podiam_voltar', (select count(*) from c where created_at < now() - interval '1 day'),
    'voltaram', (select count(*) from c where voltou),
    'ativos7', (select count(*) from c where ativo7)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_funil() from public, anon;
grant execute on function public.admin_funil() to authenticated;

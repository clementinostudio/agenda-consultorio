-- Painel do dono: o WhatsApp que a pessoa informou no app (perfis.dados) e de onde ela veio (gravado no cadastro).
-- Só muda o que a função devolve: nenhuma tabela nova.
create or replace function public.admin_usuarios()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.exigir_admin();
  select coalesce(jsonb_agg(to_jsonb(u) order by u.criado_em desc), '[]'::jsonb) into r from (
    select au.id, au.email, coalesce(p.nome, '') as nome, au.created_at as criado_em, au.last_sign_in_at as ultimo_login,
           au.email_confirmed_at is not null as email_ok, au.banned_until as bloqueado_ate,
           coalesce(au.raw_app_meta_data ->> 'provider', 'email') as provedor,
           p.dados ->> 'whatsapp' as whatsapp,
           au.raw_user_meta_data ->> 'origem' as origem,
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

#!/usr/bin/env bash
# Liga o painel do dono (app.avina.com.br/admin/): cria no banco o registro de acessos e as funções do painel,
# coloca a sua conta como admin e publica o servidor com as rotas do painel.
# Rode uma vez:  bash ligar-admin.sh seu@email.com   (o e-mail da sua conta no app)
# Para dar acesso a mais alguém depois, rode de novo com o e-mail da pessoa.
set -e
cd "$(dirname "$0")"

EMAIL="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
if ! printf '%s' "$EMAIL" | grep -Eq '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'; then
  echo "Use assim:  bash ligar-admin.sh seu@email.com   (o e-mail da sua conta no app)"
  exit 1
fi

echo ""
echo "1/3  Criando o painel no banco (Supabase)..."
npx --yes supabase@2 db push

echo ""
echo "2/3  Colocando $EMAIL como admin..."
# uma consulta só: o que acabou de entrar + o que já estava (dá 1 nos dois casos, 0 se a conta não existe)
SAIDA="$(npx --yes supabase@2 db query --linked "with novo as (insert into public.admins (user_id) select id from auth.users where lower(email) = '$EMAIL' on conflict do nothing returning user_id) select (select count(*) from novo) + (select count(*) from public.admins a join auth.users u on u.id = a.user_id where lower(u.email) = '$EMAIL') as admins")"
if ! printf '%s' "$SAIDA" | grep -Eq '"admins": *1([^0-9]|$)'; then
  echo "$SAIDA"
  echo "Não achei uma conta com o e-mail $EMAIL. Crie a conta no app primeiro (ou confira o e-mail) e rode de novo."
  exit 1
fi

echo ""
echo "3/3  Publicando o servidor com as rotas do painel..."
(cd servidor-avisos && npx wrangler deploy)

echo ""
echo "Pronto! Falta publicar o app (bash publicar.sh). Depois abra no computador:"
echo "  https://app.avina.com.br/admin/"
echo "Na primeira vez o painel mostra um QR para o app autenticador (Google Authenticator, 2FAS...)."
echo "Sem o código dele, o painel não abre, nem para você."

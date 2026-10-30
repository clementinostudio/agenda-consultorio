#!/usr/bin/env bash
# Liga o "Conectar meu banco" (Open Finance pela Pluggy) no Importar extrato do app.
# Antes: em https://dashboard.pluggy.ai → sua aplicação → Credenciais, clique em "Gerar client secret" e copie.
# Rode:
#   bash ligar-banco.sh      (no PowerShell: & "C:\Program Files\Git\bin\bash.exe" ligar-banco.sh)
# O script pede o Client ID e o Client Secret (o secret não aparece enquanto você cola), confere com a Pluggy,
# guarda os dois como segredos do servidor (nunca vão para o GitHub nem para o app) e publica o servidor.
# Enquanto o wrangler.jsonc tiver BANCO_ABERTO = "admin", só quem é admin vê a opção no app.
set -e
cd "$(dirname "$0")"
verde() { printf "\n\033[1;32m%s\033[0m\n" "$1"; }
erro() { printf "\n\033[1;31m%s\033[0m\n" "$1"; exit 1; }

read -r -p "Client ID da Pluggy: " ID
read -r -s -p "Client Secret da Pluggy (cole e aperte Enter): " SECRET; echo
ID="$(printf '%s' "$ID" | tr -d '[:space:]')"; SECRET="$(printf '%s' "$SECRET" | tr -d '[:space:]')"
[ ${#ID} -ge 30 ] || erro "O Client ID parece curto demais. Copie de novo do painel da Pluggy."
[ ${#SECRET} -ge 20 ] || erro "O Client Secret parece curto demais. Gere um novo no painel da Pluggy e cole inteiro."

echo "1/3  Conferindo com a Pluggy..."
OK=$(curl -s -X POST https://api.pluggy.ai/auth -H "Content-Type: application/json" -d "{\"clientId\":\"$ID\",\"clientSecret\":\"$SECRET\"}" || true)
printf '%s' "$OK" | grep -q '"apiKey"' || erro "A Pluggy não aceitou. Confira o Client ID e gere um Client Secret novo (ele só aparece uma vez)."

echo "2/3  Guardando como segredos do servidor..."
(cd servidor-avisos && printf '%s' "$ID" | npx wrangler secret put PLUGGY_ID && printf '%s' "$SECRET" | npx wrangler secret put PLUGGY_SECRET)

echo "3/3  Publicando o servidor..."
(cd servidor-avisos && npx wrangler deploy)

R=$(curl -s -X POST https://agenda-avisos.alvena.workers.dev/banco/estado -H "Origin: https://app.avina.com.br" -H "Content-Type: application/json" -d '{}' || true)
printf '%s' "$R" | grep -q "Entre na sua conta" || erro "O servidor publicou, mas /banco/estado respondeu diferente do esperado: $R"
verde "Pronto! No app (com a sua conta de admin): Pessoal → lançamentos → Importar → Conectar meu banco. Para testar de graça, escolha \"MeuPluggy\" na lista."

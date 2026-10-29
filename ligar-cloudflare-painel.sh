#!/usr/bin/env bash
# Mostra no painel do dono (aba Sistema) os números da Cloudflare: pedidos do servidor e do site, uso do KV e da IA, visitas.
# Antes, crie um token SÓ DE LEITURA em https://dash.cloudflare.com/profile/api-tokens → Create Token → Create Custom Token:
#   Permissions:  Account → Account Analytics → Read
#                 Zone → Analytics → Read
#                 Zone → Zone → Read
#   Zone Resources: Include → Specific zone → avina.com.br
# Cole o token sozinho no arquivo servidor-avisos/cloudflare-token.txt e rode:
#   bash ligar-cloudflare-painel.sh      (no PowerShell: & "C:\Program Files\Git\bin\bash.exe" ligar-cloudflare-painel.sh)
# O token vira um segredo do servidor e o arquivo é apagado.
set -e
cd "$(dirname "$0")"
verde() { printf "\n\033[1;32m%s\033[0m\n" "$1"; }
erro() { printf "\n\033[1;31m%s\033[0m\n" "$1"; exit 1; }
ARQ="servidor-avisos/cloudflare-token.txt"

[ -f "$ARQ" ] || erro "Crie o arquivo $ARQ com o token dentro (veja as instruções no começo deste script)."
TOKEN="$(tr -d '[:space:]' < "$ARQ")"
[ ${#TOKEN} -ge 30 ] || erro "O arquivo $ARQ não parece ter um token (ficou curto demais)."

echo "1/2  Conferindo o token com a Cloudflare..."
OK=$(curl -s https://api.cloudflare.com/client/v4/user/tokens/verify -H "Authorization: Bearer $TOKEN" || true)
printf '%s' "$OK" | grep -q '"status":"active"' || erro "A Cloudflare não aceitou o token. Confira se copiou inteiro e se ele está ativo."

echo "2/2  Guardando como segredo do servidor..."
(cd servidor-avisos && printf '%s' "$TOKEN" | npx wrangler secret put CF_API_TOKEN)
rm -f "$ARQ"
verde "Pronto! Abra o painel → Sistema. (O arquivo com o token foi apagado.)"

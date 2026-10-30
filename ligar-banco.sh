#!/usr/bin/env bash
# Liga o "Conectar meu banco" (Open Finance pela Pluggy) no Importar extrato do app.
# Antes: em https://dashboard.pluggy.ai → Aplicações → sua aplicação, clique em "Gerar client secret" e copie.
# Abra o arquivo servidor-avisos/pluggy.txt (no VS Code), troque a 2ª linha pelo secret, salve e rode:
#   bash ligar-banco.sh      (no PowerShell: & "C:\Program Files\Git\bin\bash.exe" ligar-banco.sh)
# Linha 1 do arquivo = Client ID, linha 2 = Client Secret. O script confere com a Pluggy, guarda os dois como
# segredos do servidor (nunca vão para o GitHub nem para o app), apaga o arquivo e publica o servidor.
# Enquanto o wrangler.jsonc tiver BANCO_ABERTO = "admin", só quem é admin vê a opção no app.
set -e
cd "$(dirname "$0")"
verde() { printf "\n\033[1;32m%s\033[0m\n" "$1"; }
erro() { printf "\n\033[1;31m%s\033[0m\n" "$1"; exit 1; }
ARQ="servidor-avisos/pluggy.txt"

[ -f "$ARQ" ] || erro "Crie o arquivo $ARQ: na 1ª linha o Client ID, na 2ª o Client Secret."
ID="$(sed -n 1p "$ARQ" | tr -d '[:space:]')"; SECRET="$(sed -n 2p "$ARQ" | tr -d '[:space:]')"
[ ${#ID} -ge 30 ] || erro "A 1ª linha de $ARQ deveria ser o Client ID (copie do painel da Pluggy)."
case "$SECRET" in ""|COLE*) erro "Troque a 2ª linha de $ARQ pelo Client Secret (painel da Pluggy → Gerar client secret) e SALVE o arquivo (Ctrl+S).";; esac
[ ${#SECRET} -ge 20 ] || erro "O Client Secret na 2ª linha de $ARQ parece curto demais. Gere um novo e cole inteiro."

echo "1/3  Conferindo com a Pluggy..."
OK=$(curl -s -X POST https://api.pluggy.ai/auth -H "Content-Type: application/json" -d "{\"clientId\":\"$ID\",\"clientSecret\":\"$SECRET\"}" || true)
printf '%s' "$OK" | grep -q '"apiKey"' || erro "A Pluggy não aceitou. Confira o Client ID (linha 1) e gere um Client Secret novo (ele só aparece uma vez)."

echo "2/3  Guardando como segredos do servidor..."
(cd servidor-avisos && printf '%s' "$ID" | npx wrangler secret put PLUGGY_ID && printf '%s' "$SECRET" | npx wrangler secret put PLUGGY_SECRET)
rm -f "$ARQ"

echo "3/3  Publicando o servidor..."
(cd servidor-avisos && npx wrangler deploy)

R=$(curl -s -X POST https://agenda-avisos.alvena.workers.dev/banco/estado -H "Origin: https://app.avina.com.br" -H "Content-Type: application/json" -d '{}' || true)
printf '%s' "$R" | grep -q "Entre na sua conta" || erro "O servidor publicou, mas /banco/estado respondeu diferente do esperado: $R"
verde "Pronto! No app (com a sua conta de admin): Pessoal → lançamentos → Importar → Conectar meu banco. Para o primeiro teste, escolha \"Pluggy Bank\" na lista. (O arquivo com o secret foi apagado.)"

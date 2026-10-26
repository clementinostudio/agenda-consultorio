#!/usr/bin/env bash
# Liga os avisos com o app fechado (iPhone e Android) e a fala pelo servidor (Whisper, grátis na Cloudflare).
# Rode da pasta do projeto:   bash servidor-avisos/instalar-avisos.sh
# Pode rodar de novo quando quiser: ele reaproveita o que já existe.
set -e
cd "$(dirname "$0")"
verde() { printf "\n\033[1;32m%s\033[0m\n" "$1"; }
erro() { printf "\n\033[1;31m%s\033[0m\n" "$1"; exit 1; }

# Node (o mesmo que o instalar.sh deixou pronto)
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
command -v node >/dev/null 2>&1 || erro "Falta o Node. Rode antes: bash instalar.sh"
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || erro "O Node precisa ser 20 ou mais novo. Rode: bash instalar.sh"

verde "1/5 Instalando o servidor de avisos..."
npm install --no-audit --no-fund

verde "2/5 Entrando na Cloudflare (grátis)..."
if ! npx wrangler whoami 2>/dev/null | grep -qi "associated with the email\|account id\|Account Name"; then
  echo "Vai abrir o navegador. Crie a conta (ou entre) e clique em Allow / Permitir."
  npx wrangler login
fi

verde "3/5 Preparando o armazenamento dos avisos..."
acha_kv() {
  npx wrangler kv namespace list 2>/dev/null | node -e '
    let t = require("fs").readFileSync(0, "utf8"); t = t.slice(t.indexOf("["), t.lastIndexOf("]") + 1);
    const l = JSON.parse(t || "[]"); const n = l.find(x => /agenda-avisos/i.test(x.title));
    process.stdout.write(n ? n.id : "");' || true
}
KV_ID=$(acha_kv)
if [ -z "$KV_ID" ]; then
  npx wrangler kv namespace create agenda-avisos-dados >/dev/null
  KV_ID=$(acha_kv)
fi
[ -n "$KV_ID" ] || erro "Não consegui criar o armazenamento na Cloudflare. Rode o comando de novo."
node -e '
  const fs = require("fs"); let t = fs.readFileSync("wrangler.jsonc", "utf8");
  t = t.replace(/,\s*"kv_namespaces"[\s\S]*?\]\s*(?=\n\})/, "");
  t = t.replace(/\n\}\s*$/, `,\n  "kv_namespaces": [{ "binding": "AVISOS", "id": "${process.argv[1]}" }]\n}\n`);
  fs.writeFileSync("wrangler.jsonc", t);' "$KV_ID"

verde "4/5 Criando as chaves dos avisos..."
[ -s .chaves.json ] || node gerar-chaves.mjs > .chaves.json
node -e 'const c = require("./.chaves.json"); process.stdout.write(JSON.stringify({ VAPID_PUBLIC: c.publica, VAPID_PRIVATE_JWK: c.privada }))' > .segredos.json

ORIGEM_GIT=$(git -C .. remote get-url origin 2>/dev/null || true)
DONO=$(gh api user -q .login 2>/dev/null || true)
# Sem o gh (comum no Windows): o usuário sai do endereço do repositório (github.com/USUARIO/repo)
[ -n "$DONO" ] || DONO=$(echo "$ORIGEM_GIT" | sed -n 's#.*github\.com[:/]\([^/]*\)/.*#\1#p')
REPO=$(basename -s .git "$ORIGEM_GIT" 2>/dev/null || echo agenda-consultorio)
[ -n "$DONO" ] || read -rp "Qual é o seu usuário do GitHub? " DONO
SITE="https://$(echo "$DONO" | tr 'A-Z' 'a-z').github.io"

verde "5/5 Publicando o servidor..."
LOG=$(mktemp)
CMD="npx wrangler deploy --secrets-file .segredos.json --var VAPID_SUB:$SITE/$REPO/ --var ORIGEM:$SITE"
if command -v script >/dev/null 2>&1; then script -qec "$CMD" "$LOG"; else $CMD 2>&1 | tee "$LOG"; fi
rm -f .segredos.json
URL=$(sed 's/\x1b\[[0-9;]*m//g' "$LOG" | grep -o 'https://[a-zA-Z0-9.-]*workers\.dev' | head -1)
rm -f "$LOG"
if [ -z "$URL" ]; then
  echo "Copie o endereço que termina em .workers.dev que apareceu acima."
  read -rp "Cole aqui: " URL
fi
URL=${URL%/}
curl -fsS "$URL/chave" >/dev/null && echo "Servidor respondendo em $URL" || echo "(o servidor pode levar 1 minuto para responder pela primeira vez)"

# Conta para o app onde está o servidor e publica o app de novo
cd ..
if gh variable set AVISOS_URL --body "$URL" 2>/dev/null; then
  gh workflow run deploy.yml >/dev/null 2>&1 && sleep 8 && gh run watch "$(gh run list --workflow=deploy.yml -L1 --json databaseId -q '.[0].databaseId')" || true
  verde "Pronto! Avisos com o app fechado e fala pelo servidor ligados."
  echo "No iPhone: feche e abra o app pelo ícone, vá em Ajustes > Avisos e toque em 'Ligar avisos com o app fechado'."
else
  verde "Servidor pronto em: $URL"
  echo "Falta só contar ao GitHub onde está o servidor (o gh não está instalado):"
  echo "  1. Abra https://github.com/$DONO/$REPO/settings/variables/actions/new"
  echo "  2. Name: AVISOS_URL   Value: $URL   e clique em Add variable"
  echo "  3. Publique o app de novo (git push, ou Actions > Deploy > Run workflow)"
  echo "Ou, só neste aparelho: no app, Ajustes > Avisos > Servidor, cole esse endereço."
fi

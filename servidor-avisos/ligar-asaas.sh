#!/usr/bin/env bash
# Liga a assinatura de verdade (Asaas) no servidor do Avina.
# Rode da pasta do projeto:   bash servidor-avisos/ligar-asaas.sh
# Começa no sandbox (testes, dinheiro de mentirinha). Para a conta de verdade, depois: bash servidor-avisos/ligar-asaas.sh producao
#
# O que ele faz:
#  1. pede a chave de API do Asaas e confere se funciona
#  2. guarda a chave como segredo na Cloudflare (ela nunca vai para o app nem para o GitHub)
#  3. combina um token com o Asaas para os avisos de pagamento (webhook) e cria o webhook
#  4. publica o servidor
set -e
cd "$(dirname "$0")"
verde() { printf "\n\033[1;32m%s\033[0m\n" "$1"; }
erro() { printf "\n\033[1;31m%s\033[0m\n" "$1"; exit 1; }

if [ "$1" = "producao" ]; then
  ASAAS_URL="https://api.asaas.com/v3"; ONDE="de PRODUÇÃO (dinheiro de verdade)"; PAINEL="https://www.asaas.com"
else
  ASAAS_URL="https://api-sandbox.asaas.com/v3"; ONDE="do SANDBOX (testes)"; PAINEL="https://sandbox.asaas.com"
fi
SERVIDOR="https://agenda-avisos.alvena.workers.dev"

verde "1/5 Chave de API $ONDE"
# Jeito mais fácil: o arquivo servidor-avisos/asaas.txt (fora do GitHub), com a chave na 1ª linha e o seu e-mail na 2ª.
# Sem o arquivo, o script pergunta aqui no terminal.
ARQ="asaas.txt"
if [ -s "$ARQ" ] && grep -q '[^[:space:]]' "$ARQ"; then
  CHAVE=$(sed -n 1p "$ARQ"); EMAIL=$(sed -n 2p "$ARQ" | tr -d '\r[:space:]'); DO_ARQUIVO=1
  echo "Usando a chave do arquivo servidor-avisos/$ARQ."
else
  echo "No Asaas ($PAINEL): menu do seu nome → Integrações → Chaves de API → Gerar chave. Copie e cole aqui."
  echo "(a chave não aparece enquanto você cola: é normal)"
  read -rs CHAVE; echo
fi
# limpa o que vem junto ao colar: códigos de "colagem" de alguns terminais (VS Code, Antigravity), o caractere
# invisível do Windows, espaços, aspas e quebras de linha. Sobra só a chave.
CHAVE=$(printf "%s" "$CHAVE" | sed 's/\x1b\[20[01]~//g; s/\[20[01]~//g; s/^\xEF\xBB\xBF//' | tr -cd '[:graph:]' | tr -d '"'"'")
[ -n "$CHAVE" ] || erro "Não veio nenhuma chave."
echo "Recebi uma chave que começa com ${CHAVE:0:6}… e tem ${#CHAVE} caracteres."
case "$CHAVE" in \$aact_*) ;; *) echo "Atenção: as chaves do Asaas começam com \$aact_. Confira se copiou a chave inteira. Vou testar mesmo assim." ;; esac
OK=$(ASAAS_URL="$ASAAS_URL" CHAVE="$CHAVE" node -e '
  fetch(process.env.ASAAS_URL + "/customers?limit=1", { headers: { access_token: process.env.CHAVE, "User-Agent": "Avina" } })
    .then(r => process.stdout.write(r.ok ? "ok" : "erro " + r.status)).catch(e => process.stdout.write("rede " + ((e.cause && (e.cause.code || e.cause.message)) || e.message)));')
case "$OK" in
  ok) ;;
  "erro 401") erro "O Asaas recusou a chave (401). Confira se é a chave $ONDE (a do sandbox só funciona no sandbox) e se copiou ela inteira." ;;
  rede*) erro "Não consegui falar com o Asaas (${OK#rede }). Confira a internet e rode de novo." ;;
  *) erro "O Asaas não aceitou essa chave ($OK). Confira se é a chave $ONDE e tente de novo." ;;
esac
echo "Chave conferida."

verde "2/5 Quem pode ver a assinatura de verdade enquanto testamos"
if [ -n "$DO_ARQUIVO" ]; then
  echo "${EMAIL:-Ninguém no arquivo: liberado para todo mundo.}"
else
  echo "Escreva o e-mail que você usa para entrar no Avina (só ele verá a assinatura de verdade; os outros seguem na demonstração)."
  echo "Para liberar para todo mundo, deixe em branco e aperte Enter."
  read -r EMAIL
fi

verde "3/5 Guardando os segredos na Cloudflare"
TOKEN=$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')
printf "%s" "$CHAVE" | npx wrangler secret put ASAAS_KEY >/dev/null
printf "%s" "$TOKEN" | npx wrangler secret put ASAAS_WEBHOOK_TOKEN >/dev/null
# lista vazia (um espaço) = liberado para todo mundo
printf "%s" "${EMAIL:- }" | npx wrangler secret put ASAAS_TESTADORES >/dev/null
# o endereço do Asaas (sandbox ou produção) fica no wrangler.jsonc.
# Na produção, marca também o dia em que a cobrança começou (só na primeira vez): quem criou a conta antes
# ganha 30 dias de Pro liberado.
HOJE=$(node -e 'process.stdout.write(new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10))')
node -e '
  const fs = require("fs"); let t = fs.readFileSync("wrangler.jsonc", "utf8");
  const [url, producao, hoje] = process.argv.slice(1);
  t = t.replace(/"ASAAS_URL": "[^"]*"/, `"ASAAS_URL": "${url}"`);
  if (producao === "1" && /"COBRANCA_INICIO": ""/.test(t)) t = t.replace(/"COBRANCA_INICIO": ""/, `"COBRANCA_INICIO": "${hoje}"`);
  fs.writeFileSync("wrangler.jsonc", t);' "$ASAAS_URL" "$([ "$1" = "producao" ] && echo 1 || echo 0)" "$HOJE"
# cópia para testar no computador (fica fora do GitHub)
printf 'ASAAS_KEY=%s\nASAAS_URL=%s\nASAAS_WEBHOOK_TOKEN=%s\nMODO_TESTE=1\n' "$CHAVE" "$ASAAS_URL" "$TOKEN" > .dev.vars

verde "4/5 Publicando o servidor"
npx wrangler deploy

verde "5/5 Criando o aviso de pagamento (webhook) no Asaas"
R=$(ASAAS_URL="$ASAAS_URL" CHAVE="$CHAVE" TOKEN="$TOKEN" SERVIDOR="$SERVIDOR" EMAIL="${EMAIL:-avisos@avina.com.br}" node -e '
  const E = process.env, h = { access_token: E.CHAVE, "Content-Type": "application/json", "User-Agent": "Avina" };
  const url = E.SERVIDOR + "/asaas/webhook";
  (async () => {
    // se já existe um webhook para o servidor, troca o token dele; senão, cria
    const lista = await (await fetch(E.ASAAS_URL + "/webhooks?limit=50", { headers: h })).json().catch(() => ({}));
    const velho = (lista.data || []).find(w => w.url === url);
    const corpo = { name: "Avina", url, email: E.EMAIL, enabled: true, interrupted: false, sendType: "SEQUENTIALLY", authToken: E.TOKEN, apiVersion: 3,
      events: ["PAYMENT_CREATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVATED"] };
    const r = await fetch(E.ASAAS_URL + "/webhooks" + (velho ? "/" + velho.id : ""), { method: velho ? "PUT" : "POST", headers: h, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    process.stdout.write(r.ok ? "ok" : "erro " + ((j.errors && j.errors[0] && j.errors[0].description) || r.status));
  })().catch(e => process.stdout.write("erro " + e.message));')
[ "$R" = "ok" ] || echo "Não consegui criar o webhook ($R). Sem ele a assinatura funciona igual (o app confere direto no Asaas); dá para criar depois."

# a chave já está guardada na Cloudflare (e no .dev.vars): o arquivo de texto não precisa mais existir
[ -n "$DO_ARQUIVO" ] && rm -f "$ARQ"
verde "Pronto! A assinatura de verdade está ligada $ONDE."
[ -n "$EMAIL" ] && echo "Entre no Avina com $EMAIL e abra Perfil → Assinatura."

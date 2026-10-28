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
echo "No Asaas ($PAINEL): menu do seu nome → Integrações → Chaves de API → Gerar chave. Copie e cole aqui."
echo "(a chave não aparece enquanto você cola: é normal)"
read -rs CHAVE; echo
# tira espaços, aspas, quebras de linha e o caractere invisível que o Windows às vezes cola no começo
CHAVE=$(printf "%s" "$CHAVE" | sed 's/^\xEF\xBB\xBF//' | tr -d '\r\n\t "'"'")
[ -n "$CHAVE" ] || erro "Não veio nenhuma chave."
case "$CHAVE" in \$aact_*) ;; *) echo "Atenção: as chaves do Asaas costumam começar com \$aact_. Vou testar mesmo assim." ;; esac
OK=$(ASAAS_URL="$ASAAS_URL" CHAVE="$CHAVE" node -e '
  fetch(process.env.ASAAS_URL + "/customers?limit=1", { headers: { access_token: process.env.CHAVE, "User-Agent": "Avina" } })
    .then(r => process.stdout.write(r.ok ? "ok" : "erro " + r.status)).catch(e => process.stdout.write("erro " + e.message));')
[ "$OK" = "ok" ] || erro "O Asaas não aceitou essa chave ($OK). Confira se é a chave $ONDE e tente de novo."
echo "Chave conferida."

verde "2/5 Quem pode ver a assinatura de verdade enquanto testamos"
echo "Escreva o e-mail que você usa para entrar no Avina (só ele verá a assinatura de verdade; os outros seguem na demonstração)."
echo "Para liberar para todo mundo, deixe em branco e aperte Enter."
read -r EMAIL

verde "3/5 Guardando os segredos na Cloudflare"
TOKEN=$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')
printf "%s" "$CHAVE" | npx wrangler secret put ASAAS_KEY >/dev/null
printf "%s" "$TOKEN" | npx wrangler secret put ASAAS_WEBHOOK_TOKEN >/dev/null
# lista vazia (um espaço) = liberado para todo mundo
printf "%s" "${EMAIL:- }" | npx wrangler secret put ASAAS_TESTADORES >/dev/null
# o endereço do Asaas (sandbox ou produção) fica no wrangler.jsonc
node -e '
  const fs = require("fs"); let t = fs.readFileSync("wrangler.jsonc", "utf8");
  t = t.replace(/"ASAAS_URL": "[^"]*"/, `"ASAAS_URL": "${process.argv[1]}"`); fs.writeFileSync("wrangler.jsonc", t);' "$ASAAS_URL"
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

verde "Pronto! A assinatura de verdade está ligada $ONDE."
[ -n "$EMAIL" ] && echo "Entre no Avina com $EMAIL e abra Perfil → Assinatura."

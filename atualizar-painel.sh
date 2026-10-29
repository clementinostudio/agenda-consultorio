#!/usr/bin/env bash
# Atualiza o painel do dono (app.avina.com.br/admin/): banco (ações, registro, IPs, números) e servidor (códigos,
# cortesia, avisos, excluir conta, Cloudflare). No fim confere se o servidor ficou mesmo no ar.
# Rode:  bash atualizar-painel.sh      (no PowerShell: & "C:\Program Files\Git\bin\bash.exe" atualizar-painel.sh)
# Depois publique o app:  git push
set -e
cd "$(dirname "$0")"
verde() { printf "\n\033[1;32m%s\033[0m\n" "$1"; }
erro() { printf "\n\033[1;31m%s\033[0m\n" "$1"; exit 1; }

echo ""
echo "1/3  Atualizando o banco (Supabase)..."
npx --yes supabase@2 db push || erro "O banco não atualizou. Veja a mensagem acima e rode de novo."

echo ""
echo "2/3  Publicando o servidor de avisos (Cloudflare)..."
(cd servidor-avisos && npx wrangler deploy) || erro "O servidor não publicou. Se pedir login, rode: cd servidor-avisos && npx wrangler login  (e depois este script de novo)."

echo ""
echo "3/3  Conferindo se o servidor novo está no ar..."
sleep 3
R=$(curl -s -X POST https://agenda-avisos.alvena.workers.dev/admin/codigos -H "Origin: https://app.avina.com.br" || true)
if printf '%s' "$R" | grep -q "Só para o admin"; then
  verde "Pronto! Banco e servidor atualizados."
  echo "Agora publique o app:  git push"
  echo "Para ver os números da Cloudflare no painel (aba Sistema): bash ligar-cloudflare-painel.sh"
else
  erro "O servidor respondeu outra coisa ($R). Rode de novo daqui a 1 minuto; se continuar, me mande essa mensagem."
fi

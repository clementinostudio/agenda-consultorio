#!/usr/bin/env bash
# Sobe o app para o seu GitHub e publica no GitHub Pages (de graça), só pelo terminal.
# Primeira vez:   bash publicar.sh                (cria o repositório "agenda-consultorio")
#                 bash publicar.sh outro-nome     (se quiser outro nome)
# Depois de mudar alguma coisa, rode de novo:  bash publicar.sh
set -e
cd "$(dirname "$0")"
REPO="${1:-agenda-consultorio}"

instalar() { echo "→ Instalando $1..."; sudo apt update -qq && sudo apt install -y "$1" || { echo "Não consegui instalar o $1 pelo apt. Veja: $2"; exit 1; }; }
command -v git >/dev/null 2>&1 || instalar git "https://git-scm.com/download/linux"
command -v gh  >/dev/null 2>&1 || instalar gh  "https://github.com/cli/cli/blob/trunk/docs/install_linux.md"

if ! gh auth status >/dev/null 2>&1; then
  echo "→ Entre na sua conta do GitHub. Vai aparecer um código: copie, aperte Enter e cole no navegador."
  gh auth login --hostname github.com --web --git-protocol https
fi
DONO="$(gh api user -q .login)"

git config --global user.name  >/dev/null 2>&1 || git config --global user.name "$DONO"
git config --global user.email >/dev/null 2>&1 || git config --global user.email "$(gh api user -q .id)+$DONO@users.noreply.github.com"

[ -d .git ] || git init -q -b main
git add -A
git commit -qm "Atualização $(date '+%d/%m/%Y %H:%M')" || echo "→ Nada novo para salvar."

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "→ Criando o repositório $DONO/$REPO..."
  gh repo create "$REPO" --public --source=. --remote=origin --push
  echo "→ Ligando o GitHub Pages..."
  gh api -X POST "repos/$DONO/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 \
    || gh api -X PUT "repos/$DONO/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 || true
  # O primeiro envio aconteceu antes do Pages existir; publica de novo agora que está ligado
  sleep 4
  gh workflow run deploy.yml >/dev/null 2>&1 || true
else
  echo "→ Enviando as mudanças..."
  git push -q origin main
fi

echo "→ Publicando (leva uns 2 minutos)..."
sleep 8
RUN_ID="$(gh run list --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')"
if gh run watch "$RUN_ID" --exit-status >/dev/null; then
  echo ""
  echo "✓ Publicado! Abra no celular:  https://$DONO.github.io/$REPO/"
else
  echo ""
  echo "✗ A publicação falhou. Veja o motivo em:  https://github.com/$DONO/$REPO/actions"
  exit 1
fi

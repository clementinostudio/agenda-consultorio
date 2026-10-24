#!/usr/bin/env bash
# Prepara e abre o app no seu computador, só pelo terminal.
# Uso:  bash instalar.sh
set -e
cd "$(dirname "$0")"

carregar_nvm() { export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || true; }
node_ok() { command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]; }

carregar_nvm
if ! node_ok; then
  echo "→ Instalando o Node.js 22 (só na primeira vez)..."
  command -v curl >/dev/null 2>&1 || { echo "Falta o curl. Rode antes:  sudo apt install -y curl"; exit 1; }
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  carregar_nvm
  nvm install 22
fi
echo "→ Usando Node $(node -v)"

echo "→ Instalando as dependências do app (só demora na primeira vez)..."
npm install --no-audit --no-fund

echo ""
echo "✓ Tudo pronto! Abrindo o app..."
echo "  No computador:              http://localhost:5173"
echo "  No celular (mesmo Wi-Fi):  use o endereço 'Network' que aparece logo abaixo"
echo "  Para parar:                Ctrl + C"
echo ""
npm run dev

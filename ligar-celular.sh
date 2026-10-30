#!/usr/bin/env bash
# Abre o app do celular (pasta app-celular) para testar no Expo Go, no iPhone ou no Android.
# 1. Instale o "Expo Go" na loja do celular.
# 2. Rode: bash ligar-celular.sh
# 3. No iPhone, aponte a câmera para o QR code; no Android, abra o Expo Go e leia o QR code.
# Celular e computador precisam estar no mesmo Wi-Fi. Se não conectar, rode: bash ligar-celular.sh --tunnel
# O app leva dentro uma cópia do Avina (o mesmo do site): este script monta essa cópia antes, com o código de agora.
cd "$(dirname "$0")" || exit 1
if [ ! -d node_modules ]; then echo "Instalando o site (só na primeira vez)..."; npm install --no-audit --no-fund || exit 1; fi
echo "Montando o Avina para dentro do app..."
npm run --silent build:celular || exit 1
cd app-celular || exit 1
if [ ! -d node_modules ]; then echo "Instalando o app (só na primeira vez, demora uns minutos)..."; npm install --no-audit --no-fund || exit 1; fi
if [ "$1" = "--tunnel" ] && [ ! -d node_modules/@expo/ngrok ]; then npm install --no-save @expo/ngrok@^4.1.0 --no-audit --no-fund; fi
npx expo start --clear "$@"

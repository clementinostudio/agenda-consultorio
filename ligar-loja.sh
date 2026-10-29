#!/usr/bin/env bash
# Liga o modo Loja de verdade: cria as tabelas da loja na nuvem (Supabase) e publica o servidor
# com os pacotes Pro Loja e Loja + Pessoal. Rode uma vez: bash ligar-loja.sh
set -e
cd "$(dirname "$0")"

echo ""
echo "1/2  Criando as tabelas da loja na nuvem (Supabase)..."
npx --yes supabase@2 db push

echo ""
echo "2/2  Publicando o servidor com os planos da Loja..."
(cd servidor-avisos && npx wrangler deploy)

echo ""
echo "Pronto! Agora publique o app (bash publicar.sh) e a Loja aparece em Perfil -> Como você usa o app."

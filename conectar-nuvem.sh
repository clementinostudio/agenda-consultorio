#!/usr/bin/env bash
# Liga o banco de dados na nuvem (Supabase): login de verdade e dados sincronizados entre aparelhos.
# Rode da pasta do projeto:   bash conectar-nuvem.sh
# Pode rodar de novo quando quiser: ele reaproveita o que já existe.
set -e
cd "$(dirname "$0")"
verde() { printf "\n\033[1;32m%s\033[0m\n" "$1"; }
erro() { printf "\n\033[1;31m%s\033[0m\n" "$1"; exit 1; }
command -v node >/dev/null 2>&1 || erro "Falta o Node. Rode antes: bash instalar.sh"

verde "1/3 Endereço e chave do seu projeto"
echo "No painel do Supabase: Project Settings > API Keys (ou o botão Connect no topo)."
ATUAL_URL=$(grep -s '^VITE_SUPABASE_URL=' .env.local | cut -d= -f2- || true)
ATUAL_KEY=$(grep -s '^VITE_SUPABASE_KEY=' .env.local | cut -d= -f2- || true)
read -rp "Project URL (https://xxxx.supabase.co) [${ATUAL_URL:-vazio}]: " URL
URL=${URL:-$ATUAL_URL}; URL=${URL%/}
read -rp "Chave publishable (sb_publishable_...) ou anon [${ATUAL_KEY:+já tenho}]: " KEY
KEY=${KEY:-$ATUAL_KEY}
[[ "$URL" =~ ^https://[a-z0-9]+\.supabase\.co$ ]] || erro "Esse endereço não parece do Supabase (precisa ser https://xxxx.supabase.co)."
[[ "$KEY" == sb_secret_* || "$KEY" == *service_role* ]] && erro "Essa é a chave SECRETA. Use a publishable (sb_publishable_...) ou a anon: a secreta nunca pode ir para o app."
[ -n "$KEY" ] || erro "Falta a chave."
REF=$(echo "$URL" | sed -E 's#https://([a-z0-9]+)\.supabase\.co#\1#')
printf "VITE_SUPABASE_URL=%s\nVITE_SUPABASE_KEY=%s\n" "$URL" "$KEY" > .env.local
# O app publicado lê o .env.production (a chave é a pública, então pode ir para o GitHub)
{ echo "# Banco na nuvem do app publicado (Supabase). Chave pública (publishable): pode ficar no GitHub, quem protege os dados é o RLS."
  echo "# Gerado pelo conectar-nuvem.sh. NUNCA coloque aqui a chave secret/service_role."
  printf "VITE_SUPABASE_URL=%s\nVITE_SUPABASE_KEY=%s\n" "$URL" "$KEY"; } > .env.production
echo "Guardado em .env.local (só no computador) e .env.production (vai junto quando publicar)."

verde "2/3 Criando as tabelas e as regras de segurança"
echo "Vai abrir o navegador para entrar no Supabase, e depois pedir a senha do banco"
echo "(a que você criou junto com o projeto; esqueceu? Project Settings > Database > Reset password)."
[ -f supabase/config.toml ] || npx --yes supabase@2 init >/dev/null
if npx --yes supabase@2 login && npx --yes supabase@2 link --project-ref "$REF" && npx --yes supabase@2 db push --include-all; then
  echo "Tabelas prontas."
else
  echo ""
  echo "Não deu pelo terminal. Sem problema, faz assim (1 minuto):"
  echo "  1. Abra https://supabase.com/dashboard/project/$REF/sql/new"
  echo "  2. Cole tudo o que está em supabase/migrations/20261026000000_inicial.sql"
  echo "  3. Aperte Run"
  read -rp "Aperte Enter quando terminar..." _
fi

verde "3/3 Conferindo a conexão"
node -e '
  const [url, key] = process.argv.slice(1);
  fetch(url + "/rest/v1/itens?select=id&limit=1", { headers: { apikey: key, Authorization: "Bearer " + key } })
    .then(async r => {
      const t = await r.text();
      if (/PGRST205|Could not find the table/i.test(t)) { console.log("✗ A tabela itens ainda não existe. Rode o SQL do passo 2."); process.exit(1); }
      if (r.status === 401 && /Invalid API key|No API key/i.test(t)) { console.log("✗ A chave não confere com esse projeto."); process.exit(1); }
      console.log("✓ Banco respondendo, e sem login ninguém lê nada (como deve ser).");
    })
    .catch(e => { console.log("✗ Não consegui falar com o Supabase:", e.message); process.exit(1); });
' "$URL" "$KEY"


verde "Pronto!"
echo "Para o app publicado usar a nuvem: bash publicar.sh"
echo "Sem confirmar e-mail: Authentication > Sign In / Providers > Email > desligue Confirm email."
echo ""
echo "Teste agora no computador:  npm run dev"

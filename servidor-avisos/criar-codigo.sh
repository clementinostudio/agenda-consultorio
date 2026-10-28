#!/usr/bin/env bash
# Códigos de acesso do Avina: quem digita o código no app (Perfil → Assinatura) ganha o Pro completo liberado por alguns dias.
#
# Individuais (o melhor contra quem espalha): bash servidor-avisos/criar-codigo.sh gerar 15 30
#             → 15 códigos diferentes, cada um vale para UMA pessoa só, liberando 30 dias. Mande um para cada pessoa.
# Criar:      bash servidor-avisos/criar-codigo.sh BETA30 30 20        (código, dias liberados, quantas pessoas podem usar)
#             bash servidor-avisos/criar-codigo.sh BETA30 30 20 2026-11-30   (opcional: até quando o código pode ser usado)
# Ver uso:    bash servidor-avisos/criar-codigo.sh ver BETA30
# Desligar:   bash servidor-avisos/criar-codigo.sh apagar BETA30      (quem já usou continua com os dias que ganhou)
#
# No PowerShell, troque "bash" por: & "C:\Program Files\Git\bin\bash.exe"
set -e
cd "$(dirname "$0")"
verde() { printf "\n\033[1;32m%s\033[0m\n" "$1"; }
erro() { printf "\n\033[1;31m%s\033[0m\n" "$1"; exit 1; }
limpo() { printf "%s" "$1" | tr '[:lower:]' '[:upper:]' | tr -cd 'A-Z0-9' | cut -c1-20; }

case "$1" in
  ""|-h|--help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  gerar)
    # códigos individuais: cada um vale para UMA pessoa só (se alguém repassar, não serve para mais ninguém)
    QTD="${2:-10}"; DIAS="${3:-30}"; VALIDO="${4:-}"
    [[ "$QTD" =~ ^[0-9]+$ ]] && [ "$QTD" -ge 1 ] && [ "$QTD" -le 200 ] || erro "Quantos códigos? Um número de 1 a 200."
    [[ "$DIAS" =~ ^[0-9]+$ ]] && [ "$DIAS" -ge 1 ] && [ "$DIAS" -le 365 ] || erro "Dias precisa ser um número de 1 a 365."
    [ -z "$VALIDO" ] || [[ "$VALIDO" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || erro "A data precisa ser assim: 2026-11-30"
    ARQ=$(mktemp)
    # letras e números sem os que confundem (0/O, 1/I/L)
    node -e '
      const [q, d, v, arq] = process.argv.slice(1), al = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", c = require("crypto");
      const cod = () => "AVN" + Array.from(c.randomBytes(6), b => al[b % al.length]).join("");
      const lista = Array.from({ length: +q }, () => ({ key: "codigo:" + cod(), value: JSON.stringify({ dias: +d, max: 1, usados: 0, ...(v ? { validoAte: v } : {}) }) }));
      require("fs").writeFileSync(arq, JSON.stringify(lista));' "$QTD" "$DIAS" "$VALIDO" "$ARQ"
    npx wrangler kv bulk put "$ARQ" --binding AVISOS --remote >/dev/null
    verde "Pronto! $QTD códigos de uso único, cada um libera $DIAS dias${VALIDO:+ (usar até $VALIDO)}:"
    node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).forEach(x => console.log("  " + x.key.slice(7)))' "$ARQ"
    echo "Mande um código diferente para cada pessoa. Guarde esta lista."
    rm -f "$ARQ"; exit 0 ;;
  ver)
    COD=$(limpo "$2"); [ -n "$COD" ] || erro "Diga qual código: bash servidor-avisos/criar-codigo.sh ver BETA30"
    V=$(npx wrangler kv key get "codigo:$COD" --binding AVISOS --remote 2>/dev/null || true)
    [ -n "$V" ] && [ "$V" != "Value not found" ] || erro "Não achei o código $COD."
    printf "%s" "$V" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);console.log(`Código ${process.argv[1]}: ${c.usados||0} de ${c.max} pessoas já usaram · libera ${c.dias} dias${c.validoAte?` · pode ser usado até ${c.validoAte}`:""}`);})' "$COD"
    exit 0 ;;
  apagar)
    COD=$(limpo "$2"); [ -n "$COD" ] || erro "Diga qual código: bash servidor-avisos/criar-codigo.sh apagar BETA30"
    npx wrangler kv key delete "codigo:$COD" --binding AVISOS --remote >/dev/null
    verde "Código $COD desligado. Quem já usou continua com os dias que ganhou."; exit 0 ;;
esac

COD=$(limpo "$1"); DIAS="${2:-30}"; MAX="${3:-20}"; VALIDO="${4:-}"
[ ${#COD} -ge 4 ] || erro "O código precisa ter pelo menos 4 letras ou números (ex.: BETA30)."
[[ "$DIAS" =~ ^[0-9]+$ ]] && [ "$DIAS" -ge 1 ] && [ "$DIAS" -le 365 ] || erro "Dias precisa ser um número de 1 a 365."
[[ "$MAX" =~ ^[0-9]+$ ]] && [ "$MAX" -ge 1 ] || erro "Quantas pessoas precisa ser um número (ex.: 20)."
[ -z "$VALIDO" ] || [[ "$VALIDO" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || erro "A data precisa ser assim: 2026-11-30"
# criar de novo um código que já existe mantém a contagem de quem já usou
ANTES=$(npx wrangler kv key get "codigo:$COD" --binding AVISOS --remote 2>/dev/null || true)
USADOS=$(printf "%s" "$ANTES" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).usados||0))}catch(e){process.stdout.write("0")}})')
VALOR=$(node -e 'const [d,m,u,v]=process.argv.slice(1);process.stdout.write(JSON.stringify({dias:+d,max:+m,usados:+u,...(v?{validoAte:v}:{})}))' "$DIAS" "$MAX" "$USADOS" "$VALIDO")
npx wrangler kv key put "codigo:$COD" "$VALOR" --binding AVISOS --remote >/dev/null
verde "Pronto! Código $COD criado."
echo "Libera o Pro completo por $DIAS dias, para até $MAX pessoas${VALIDO:+, usando até $VALIDO}."
echo "A pessoa entra no app e vai em Perfil → Assinatura → Tenho um código de acesso."

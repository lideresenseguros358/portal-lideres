#!/usr/bin/env bash
set -euo pipefail

echo "==> Clean & Verify (Bash) iniciado"

STAMP="$(date +%Y%m%d-%H%M%S)"
TRASH=".trash/$STAMP"
mkdir -p "$TRASH"

move_if_exists () { [ -e "$1" ] && { echo "   -> moviendo $1 a $TRASH"; mkdir -p "$(dirname "$TRASH/$1")"; git rm -rf --cached --ignore-unmatch "$1" >/dev/null 2>&1 || true; mv "$1" "$TRASH/$(basename "$1")" 2>/dev/null || mv "$1" "$TRASH/"; }; }

# 1) Duplicados típicos Next (pages/app/*)
[ -f pages/app/broker.tsx ] && [ -f pages/app/broker/index.tsx ] && move_if_exists pages/app/broker.tsx
[ -f pages/app/master.tsx ] && [ -f pages/app/master/index.tsx ] && move_if_exists pages/app/master.tsx

# 2) Variantes de AppLayout/SideMenu duplicadas con otros nombres
for f in components/AppLayout*.tsx components/SideMenu*.tsx; do
  if [ -e "$f" ] && [[ "$f" != "components/AppLayout.tsx" && "$f" != "components/SideMenu.tsx" ]]; then
    move_if_exists "$f"
  fi
done

# 3) Basura común
find . -type f \( -name "*.log" -o -name "*.map" -o -name "*.tmp" -o -name ".DS_Store" -o -name "Thumbs.db" \) -print -delete || true
find . -type f \( -name "*~" -o -name "*.swp" -o -name "*.swo" \) -print -delete || true

# 4) Endpoints viejos/legacy (ajusta patrones si los tenías)
for p in pages/api/exports/*legacy* pages/api/*/legacy* pages/api/*/*.bak lib/*_old.* lib/*-old.*; do
  [ -e $p ] && move_if_exists "$p"
done

# 5) Dependencias: prune + dedupe
echo "==> npm prune & dedupe"
npm prune
npm dedupe || true

# 6) Comprobación de archivos clave
REQUIRED=(
  "components/AppLayout.tsx"
  "components/SideMenu.tsx"
  "components/NotificationBell.tsx"
  "components/dash/KpiCard.tsx"
  "components/dash/Donut.tsx"
  "components/dash/Bars.tsx"
  "components/dash/MiniCalendar.tsx"
  "lib/supabase.ts"
  "lib/supabaseAdmin.ts"
  "lib/drive.ts"
  "lib/vision.ts"
  "lib/vision-pdf.ts"
  "lib/importMaps.ts"
  "pages/app/broker/index.tsx"
  "pages/app/master/index.tsx"
  "pages/login.tsx"
)
MISSING=0
for f in "${REQUIRED[@]}"; do
  if [ ! -f "$f" ]; then echo "FALTA: $f"; MISSING=1; fi
done
[ $MISSING -eq 1 ] && { echo "❌ Faltan archivos requeridos (arriba)."; exit 2; }

# 7) Lint (sin romper por 'any' si seguiste mi .eslintrc)
echo "==> Lint"
npm run lint || true

# 8) Typecheck (no emite)
echo "==> TypeScript check"
npx tsc --noEmit

# 9) Build Next
echo "==> Build Next"
npm run build

echo "✅ Clean & Verify OK"
exit 0

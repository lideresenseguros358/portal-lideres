Write-Host "==> Limpieza y verificación previa"
rimraf .next node_modules/.cache 2>$null
npm run lint --silent 2>$null | Out-Null

Write-Host "==> Doctor de imports/exports"
node ./tools/doctor.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Host "Corrige lo reportado arriba. El build se detuvo." -ForegroundColor Red
  exit 1
}

Write-Host "==> TypeScript check (noEmit)"
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
  Write-Host "Errores de TypeScript. Revisa arriba." -ForegroundColor Red
  exit 1
}

Write-Host "==> Build Next.js"
npm run build

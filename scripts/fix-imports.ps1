# scripts/fix-imports.ps1
$Root = (Get-Location).Path
$Api = Join-Path $Root "pages\api"
$LibPattern = "(from\s+['""]\.\.\/\.\.\/lib\/supabaseAdmin['""])|(from\s+['""]\.\.\/\.\.\/\.\.\/lib\/supabaseAdmin['""])|(from\s+['""]\.\.\/\.\.\/lib\/supabaseAdmin\.ts['""])"
$WrongCreate = "createSupabaseAdmin"

Get-ChildItem $Api -Recurse -Include *.ts,*.tsx | ForEach-Object {
  $c = Get-Content $_.FullName -Raw

  # Reemplaza import incorrecto de supabaseAdmin
  $c = $c -replace "import\s+{?\s*supabaseAdmin\s*}?\s+from\s+['""]\.\.\/.*?['""]", "import { supabaseAdmin } from '../../lib/supabase'"
  $c = $c -replace $LibPattern, "from '../../lib/supabase'"

  # Reemplaza createSupabaseAdmin por supabaseAdmin
  $c = $c -replace $WrongCreate, "supabaseAdmin"

  Set-Content $_.FullName $c -NoNewline
  Write-Host "Arreglado: $($_.FullName)"
}

# También corrige cualquier import en /lib que apunte mal
Get-ChildItem (Join-Path $Root "lib") -Recurse -Include *.ts | ForEach-Object {
  $c = Get-Content $_.FullName -Raw
  $c = $c -replace $WrongCreate, "supabaseAdmin"
  Set-Content $_.FullName $c -NoNewline
}
Write-Host "Listo ✅"

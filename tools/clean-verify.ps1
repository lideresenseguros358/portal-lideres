<# tools/clean-verify.ps1 #>
param(
  [switch]$NoColor
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function say($text, $color = 'Cyan') {
  if ($NoColor) { Write-Host $text; return }
  Write-Host $text -ForegroundColor $color
}

say "==> Clean & Verify (PowerShell) iniciado" 'Green'

# 1) limpiar artefactos de build/cache
$trash = @(
  '.next', 'dist', 'out', '.turbo', 'coverage', '.eslintcache',
  'node_modules/.cache', 'pnpm-lock.yaml.tmp'
)
foreach ($t in $trash) {
  if (Test-Path $t) {
    try { Remove-Item $t -Recurse -Force -ErrorAction SilentlyContinue; say "Eliminado: $t" 'DarkGray' } catch {}
  }
}

# 2) borrar .js/.jsx/.map generados dentro de src
$genGlobs = @('*.js','*.jsx','*.map')
$roots = @('pages','components','lib')
foreach ($root in $roots) {
  if (Test-Path $root) {
    foreach ($g in $genGlobs) {
      Get-ChildItem -Path $root -Recurse -Filter $g -ErrorAction SilentlyContinue |
        ForEach-Object {
          try { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue; say "Eliminado: $($_.FullName)" 'DarkGray' } catch {}
        }
    }
  }
}

# 3) función para eliminar el .ts cuando exista el .tsx equivalente
function Remove-DuplicateTsWhenTsxExists([string]$searchRoot) {
  if (-not (Test-Path $searchRoot)) { return }
  # A: pares exactos base.ts + base.tsx
  $tsxFiles = Get-ChildItem -Path $searchRoot -Recurse -Filter *.tsx -ErrorAction SilentlyContinue
  foreach ($tsx in $tsxFiles) {
    $base = [System.IO.Path]::Combine($tsx.DirectoryName, [System.IO.Path]::GetFileNameWithoutExtension($tsx.Name))
    $tsCandidate = "$base.ts"
    if ((Test-Path $tsCandidate) -and (Test-Path $tsx.FullName)) {
      try {
        Remove-Item $tsCandidate -Force
        say "Duplicado resuelto: borrado $tsCandidate (se conserva $($tsx.Name))" 'Yellow'
      } catch {}
    }
  }
  # B: index.ts + index.tsx dentro de carpetas
  $indexTsx = Get-ChildItem -Path $searchRoot -Recurse -Filter index.tsx -ErrorAction SilentlyContinue
  foreach ($i in $indexTsx) {
    $tsIndex = Join-Path $i.DirectoryName 'index.ts'
    if ((Test-Path $tsIndex) -and (Test-Path $i.FullName)) {
      try {
        Remove-Item $tsIndex -Force
        say "Duplicado resuelto: borrado $tsIndex (se conserva index.tsx)" 'Yellow'
      } catch {}
    }
  }
}

# Ejecutar eliminación de duplicados en raíces típicas
foreach ($root in @('pages','components','lib')) { Remove-DuplicateTsWhenTsxExists $root }

# 4) comprobaciones mínimas
$mustExist = @('package.json','tsconfig.json','.env.local')
foreach ($f in $mustExist) {
  if (-not (Test-Path $f)) { say "Falta archivo requerido: $f" 'Red' } else { say "OK: $f" 'Green' }
}

# 5) reporte final de duplicados residuales (por si quedó algo raro)
$leftPairs = @()
$tsPairs = Get-ChildItem -Recurse -Filter *.ts -ErrorAction SilentlyContinue | Where-Object {
  $tsxAlt = [IO.Path]::ChangeExtension($_.FullName, '.tsx')
  Test-Path $tsxAlt
}
foreach ($p in $tsPairs) { $leftPairs += $p.FullName }

if ($leftPairs.Count -gt 0) {
  say "ATENCIÓN: aún hay pares .ts/.tsx duplicados:" 'Yellow'
  $leftPairs | ForEach-Object { say " - $_" 'Yellow' }
  exit 2
}

say "Limpieza y verificación terminadas ✅" 'Green'
exit 0

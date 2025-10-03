$root='C:\Users\Samud\portal-lideres'
Set-Location $root

if (-not (Test-Path '.\src\app')) { New-Item -ItemType Directory '.\src\app' | Out-Null }
@"
export const metadata = { title: 'LISSA | Inicio' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body>{children}</body></html>);
}
"@ | Set-Content '.\src\app\layout.tsx' -Encoding UTF8
@"
export default function Home() {
  return <main style={{padding:24}}>LISSA – Base OK</main>;
}
"@ | Set-Content '.\src\app\page.tsx' -Encoding UTF8

Get-ChildItem -Recurse -File -Filter 'page.js' | ForEach-Object { Remove-Item $_.FullName -Force }
Get-ChildItem -Recurse -Include *.ts,*.tsx,*.js,*.mjs | ForEach-Object {
  (Get-Content $_.FullName) -replace "\.\./app/page\.js","../app/page" |
  Set-Content $_.FullName -Encoding UTF8
}

@"
{
  "compilerOptions": {
    "target": "esnext",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
"@ | Set-Content '.\tsconfig.json' -Encoding UTF8

@"
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { turbo: { rules: {} } },
};
export default nextConfig;
"@ | Set-Content '.\next.config.ts' -Encoding UTF8

@"
/// <reference types="next" />
/// <reference types="next/types/global" />
/// <reference types="next/image-types/global" />
"@ | Set-Content '.\next-env.d.ts' -Encoding UTF8

if (-not (Test-Path '.\package.json')) {
@"
{
  "name": "portal-lissa",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build --turbo",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.5.4",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "eslint": "^9.9.0",
    "eslint-config-next": "15.5.4",
    "typescript": "^5.6.3"
  }
}
"@ | Set-Content '.\package.json' -Encoding UTF8
} else {
  $pkg = Get-Content '.\package.json' -Raw | ConvertFrom-Json
  if (-not $pkg.scripts) { $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue @{} }
  $pkg.scripts.dev = "next dev"
  $pkg.scripts.build = "next build --turbo"
  $pkg.scripts.start = "next start"
  $pkg.scripts.lint = "next lint"
  ($pkg | ConvertTo-Json -Depth 100) | Set-Content '.\package.json' -Encoding UTF8
}

npm install
npm i -D typescript @types/node @types/react @types/react-dom eslint eslint-config-next

npm run build

Write-Host "`n=== BUILD FINISHED ===` n"

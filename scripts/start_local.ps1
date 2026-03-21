param(
  [string]$EnvFile = ".env.local"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) {
  throw "Missing $EnvFile. Copy .env.local.example to .env.local first."
}

Write-Host "[start-local] Loading environment from $EnvFile"
Get-Content $EnvFile | ForEach-Object {
  if ($_ -match "^\s*#") { return }
  if ($_ -match "^\s*$") { return }
  $parts = $_ -split "=", 2
  if ($parts.Length -eq 2) {
    [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
  }
}

Write-Host "[start-local] Checking PostgreSQL connectivity"
python -c "import os, psycopg; conn=psycopg.connect(host=os.getenv('PGHOST'), dbname=os.getenv('PGDATABASE'), user=os.getenv('PGUSER'), password=os.getenv('PGPASSWORD'), port=os.getenv('PGPORT','5432')); conn.close(); print('postgres-ok')"

Write-Host "[start-local] Starting FastAPI backend (:8000)"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "uvicorn main:app --reload --port 8000"

Write-Host "[start-local] Starting Vite frontend (:5173)"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"

Write-Host "[start-local] Started. Runtime summary:"
Write-Host "  APP_ENV=$env:APP_ENV"
Write-Host "  APP_TIER=$env:APP_TIER"
Write-Host "  PGHOST=$env:PGHOST"
Write-Host "  PGDATABASE=$env:PGDATABASE"

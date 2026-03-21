param(
  [string]$DbName = "lms_leo",
  [string]$SeedFile = "prodfiles/MainChaddata.xlsx",
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

Write-Host "[reset-local] Dropping database $DbName (if exists)"
dropdb --if-exists $DbName

Write-Host "[reset-local] Creating database $DbName"
createdb $DbName

Write-Host "[reset-local] Applying setup_local_db.sql"
psql -d $DbName -f scripts/setup_local_db.sql

if (-not $SkipSeed) {
  if (-not (Test-Path $SeedFile)) {
    throw "[reset-local] Seed file not found: $SeedFile"
  }
  Write-Host "[reset-local] Seeding data from $SeedFile"
  python scripts/seed_local_data.py $SeedFile --target local
} else {
  Write-Host "[reset-local] SkipSeed enabled, not loading data."
}

Write-Host "[reset-local] Restarting local stack"
./scripts/start_local.ps1

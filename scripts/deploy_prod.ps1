param(
  [string]$Profile = "DanSiaoAuth",
  [string]$RepoId = "3889324859208374",
  [string]$Branch = "main",
  [string]$SourceCodePath = "/Workspace/Repos/nh136948@hertz.net/Prototype-LMS-Databricks",
  [string]$AppName = "hertz-leo-leadsmgmtsystem",
  [string]$BaseUrl = ""
)

$ErrorActionPreference = "Stop"

$sha = (git rev-parse HEAD).Trim()
$gate = "release/staging_passed_${sha}.json"
if (-not (Test-Path $gate)) {
  throw "[deploy-prod] Missing staging gate artifact for commit $sha: $gate"
}

$confirm = Read-Host "[deploy-prod] Type PROD to confirm deployment target"
if ($confirm -ne "PROD") {
  throw "[deploy-prod] Confirmation failed."
}

Write-Host "[deploy-prod] Build frontend"
npm run build

Write-Host "[deploy-prod] Compile Python files"
python -m compileall .

Write-Host "[deploy-prod] Schema drift check (target=prod)"
python scripts/check_schema_drift.py --target prod

Write-Host "[deploy-prod] Comparing staging/prod migration ledgers"
python scripts/compare_migration_state.py

Write-Host "[deploy-prod] Push git branch"
git push origin $Branch

Write-Host "[deploy-prod] Sync Databricks repo"
databricks repos update $RepoId --branch $Branch -p $Profile

Write-Host "[deploy-prod] Deploy app"
databricks apps deploy $AppName --source-code-path $SourceCodePath -p $Profile

if (-not $BaseUrl) {
  throw "BaseUrl is required. Pass -BaseUrl https://<prod-app-url>"
}

Write-Host "[deploy-prod] Run read-only smoke tests"
python scripts/smoke_test.py --target prod --read-only --base-url $BaseUrl

Write-Host "[deploy-prod] Completed successfully"

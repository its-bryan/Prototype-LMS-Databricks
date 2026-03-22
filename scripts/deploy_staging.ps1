param(
  [string]$Profile = "DanSiaoAuth",
  [string]$RepoId = "3281422440033516",
  [string]$Branch = "main",
  [string]$SourceCodePath = "/Workspace/Repos/nh136948@hertz.net/Prototype-LMS-Databricks",
  [string]$AppName = "hertz-leo-lms-staging",
  [string]$BaseUrl = ""
)

$ErrorActionPreference = "Stop"

Write-Host "[deploy-staging] Build frontend"
npm run build

Write-Host "[deploy-staging] Compile Python files"
python -m compileall .

Write-Host "[deploy-staging] Schema drift check (target=staging)"
python scripts/check_schema_drift.py --target staging

Write-Host "[deploy-staging] Push git branch"
git push origin $Branch

Write-Host "[deploy-staging] Sync Databricks repo"
databricks repos update $RepoId --branch $Branch -p $Profile

Write-Host "[deploy-staging] Deploy app"
databricks apps deploy $AppName --source-code-path $SourceCodePath -p $Profile

if (-not $BaseUrl) {
  throw "BaseUrl is required. Pass -BaseUrl https://<staging-app-url>"
}

Write-Host "[deploy-staging] Run smoke tests"
python scripts/smoke_test.py --target staging --base-url $BaseUrl

Write-Host "[deploy-staging] Completed successfully"

<#
  Runs the website tests (WEB-01..48) on the UAT and/or Pre-UAT website on this PC and keeps the reports locally.
  The sites (10.35.1.66) are on the office network only, so they cannot be reached from GitHub's runners.

  Examples (from the Test1 folder):
    .\scripts\run-site.ps1 -Site uat                 # UAT website      http://10.35.1.66:8103
    .\scripts\run-site.ps1 -Site pre-uat             # Pre-UAT website  http://10.35.1.66:8123
    .\scripts\run-site.ps1 -Site both                # UAT, then Pre-UAT
    .\scripts\run-site.ps1 -Site uat -Tests web-07   # Only some cases (file name filter)

  Reports per site (screenshots of every step, a video of every test, a trace of every failure):
    playwright-report-<site>\index.html    Playwright HTML report
    dashboard-<site>\index.html            Dashboard (summary, steps, screenshots, videos)
    test-results-<site>\                   Raw files: results.json, results.xml, test-execution.log.txt, videos, screenshots
#>
param(
  [ValidateSet('uat', 'pre-uat', 'both')] [string] $Site = 'both',
  [string[]] $Tests = @(),
  [switch] $NoOpen
)

$root = Split-Path -Parent $PSScriptRoot # The Test1 folder.
Set-Location $root
$sites = @{ 'uat' = 'http://10.35.1.66:8103'; 'pre-uat' = 'http://10.35.1.66:8123' }
$toRun = if ($Site -eq 'both') { @('uat', 'pre-uat') } else { @($Site) }

# KNET test PIN must be 4 digits on the payment page (the local .env value is not).
if (-not $env:TEST_KNET_PIN) { $env:TEST_KNET_PIN = '1234' }

foreach ($name in $toRun) {
  $url = $sites[$name]
  Write-Host "`n=== $name website ($url) ===" -ForegroundColor Cyan
  try { $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 }
  catch { Write-Host "Cannot reach $url (office network / VPN needed) - $name skipped." -ForegroundColor Red; continue }

  $started = Get-Date
  npx playwright test -c "playwright.$name.config.ts" @Tests # Runs the tests; reports go to the site's own folders.
  $exitCode = $LASTEXITCODE

  # Dashboard for this site (same layout as the CINESCAPE WEB dashboard), with the HTML report linked from it.
  if (Test-Path "dashboard-$name\playwright-report") { Remove-Item -Recurse -Force "dashboard-$name\playwright-report" }
  if (Test-Path "playwright-report-$name") {
    $null = New-Item -ItemType Directory -Force "dashboard-$name"
    Copy-Item -Recurse -Force "playwright-report-$name" "dashboard-$name\playwright-report"
  }
  $env:RESULTS_FILE = "test-results-$name/results.json"
  $env:DASHBOARD_DIR = "dashboard-$name"
  $env:SITE_URL = $url
  node scripts/generate-dashboard.js
  Remove-Item Env:RESULTS_FILE, Env:DASHBOARD_DIR, Env:SITE_URL

  $minutes = [math]::Round(((Get-Date) - $started).TotalMinutes, 1)
  Write-Host "$name finished in $minutes min (exit code $exitCode)." -ForegroundColor Cyan
  Write-Host "  Dashboard:   $root\dashboard-$name\index.html"
  Write-Host "  HTML report: $root\playwright-report-$name\index.html"
  Write-Host "  Shared results page: https://claude.ai/artifact/UzdLjEWvjG7hAMRXirbqfm (Load results > $root\test-results-$name\results.json)"
  if (-not $NoOpen -and (Test-Path "dashboard-$name\index.html")) { Start-Process "dashboard-$name\index.html" }
}

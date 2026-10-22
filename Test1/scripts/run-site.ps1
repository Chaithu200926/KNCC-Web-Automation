<#
  Runs the website tests (WEB-01..48) on the UAT and/or Pre-UAT website on this PC and keeps the reports locally.
  The sites (10.35.1.66) are on the office network only, so they cannot be reached from GitHub's runners.

  Examples (from the Test1 folder):
    .\scripts\run-site.ps1 -Site uat                 # UAT website      http://10.35.1.66:8103
    .\scripts\run-site.ps1 -Site pre-uat             # Pre-UAT website  http://10.35.1.66:8123
    .\scripts\run-site.ps1 -Site pre-prod            # Pre-Prod website http://10.35.1.66:8113 (not in the checklist)
    .\scripts\run-site.ps1 -Site both                # UAT, then Pre-UAT
    .\scripts\run-site.ps1 -Site uat -Tests web-07   # Only some cases (file name filter)

  Reports per site (screenshots of every step, a video of every test, a trace of every failure):
    playwright-report-<site>\index.html    Playwright HTML report
    dashboard-<site>\index.html            Dashboard (summary, steps, screenshots, videos)
    Cinescape UAT and Pre-UAT Checklist.html  WEB-01..48 on both sites (C:\softwares\KNCC testing, -Checklist to change)
    test-results-<site>\                   Raw files: results.json, results.xml, test-execution.log.txt, videos, screenshots
    C:\softwares\KNCC testing\<d Mon> reports\  RCA of the run alone + comparison RCA (scripts/build-site-rca.py)
#>
param(
  [ValidateSet('uat', 'pre-uat', 'pre-prod', 'both')] [string] $Site = 'both',
  [string[]] $Tests = @(),
  [switch] $NoOpen,
  # UAT / Pre-UAT checklist (WEB-01..48, one column per site), rebuilt after every run.
  [string] $Checklist = 'C:\softwares\KNCC testing\Cinescape UAT and Pre-UAT Checklist.html'
)

# -Tests web-26,web-31 arrives as one string through "powershell -File": split it into separate filters.
$Tests = @($Tests | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

$root = Split-Path -Parent $PSScriptRoot # The Test1 folder.
Set-Location $root
$sites = @{ 'uat' = 'http://10.35.1.66:8103'; 'pre-uat' = 'http://10.35.1.66:8123'; 'pre-prod' = 'http://10.35.1.66:8113' }
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

  # This run's results into the UAT / Pre-UAT checklist (cases not in this run keep their last result).
  if ($name -ne 'pre-prod' -and (Test-Path "test-results-$name/results.json")) { node scripts/build-site-checklist.js --add $name --out $Checklist }

  # RCA workbooks of this run (this run alone, and compared with the last reviewed UAT vs Pre-UAT RCA) in
  # C:\softwares\KNCC testing\<d Mon> reports. Needs Python with openpyxl.
  # Then the Final RCA of the day: every case with its latest result (a rerun of failed cases replaces only those).
  if (Test-Path "test-results-$name/results.json") { python scripts/build-site-rca.py $name; python scripts/build-site-rca.py $name --final }

  $minutes = [math]::Round(((Get-Date) - $started).TotalMinutes, 1)
  Write-Host "$name finished in $minutes min (exit code $exitCode)." -ForegroundColor Cyan
  Write-Host "  Dashboard:   $root\dashboard-$name\index.html"
  Write-Host "  HTML report: $root\playwright-report-$name\index.html"
  Write-Host "  Checklist:   $Checklist"
  Write-Host "  Shared results page: https://claude.ai/artifact/UzdLjEWvjG7hAMRXirbqfm (Load results > $root\test-results-$name\results.json)"
  if (-not $NoOpen -and (Test-Path "dashboard-$name\index.html")) { Start-Process "dashboard-$name\index.html" }
}

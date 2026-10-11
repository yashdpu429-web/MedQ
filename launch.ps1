# One-click launcher for Real-Time Wearable Health Anomaly Radar
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$IndexFile = Join-Path $PSScriptRoot "index.html"
$TestFile = Join-Path $PSScriptRoot "tests\test_runner.html"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   LAUNCHING WEARABLE HEALTH ANOMALY RADAR DASHBOARD      " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

$EdgePaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

$EdgeExe = $EdgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($EdgeExe) {
    Write-Host "Opening Dashboard in Microsoft Edge..." -ForegroundColor Green
    Start-Process $EdgeExe -ArgumentList "file:///$IndexFile"
} else {
    Write-Host "Opening Dashboard in Default Web Browser..." -ForegroundColor Green
    Start-Process "file:///$IndexFile"
}

Write-Host "Dashboard successfully launched!" -ForegroundColor Cyan
Write-Host "To execute the automated clinical test suite, open:" -ForegroundColor Yellow
Write-Host "file:///$TestFile" -ForegroundColor White

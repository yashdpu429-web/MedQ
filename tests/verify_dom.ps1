$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$appUrl = "file:///C:/Users/surabhi sonsale/.gemini/antigravity/scratch/health-anomaly-radar/index.html"

$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = $edgePath
$processInfo.Arguments = "--headless=new --dump-dom `"$appUrl`""
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $processInfo
$process.Start() | Out-Null
$stdout = $process.StandardOutput.ReadToEnd()
$process.WaitForExit(10000)

Write-Host "Verifying Key Elements in Main Application DOM..." -ForegroundColor Cyan

$elements = @(
    "Clinical Telemetry Overview",
    "card-hr-val",
    "card-spo2-val",
    "canvas-main-telemetry",
    "canvas-phase-space",
    "canvas-radar-decomposition",
    "canvas-ecg",
    "doctor-alert-preview",
    "btn-emergency-spike"
)

foreach ($el in $elements) {
    if ($stdout.Contains($el)) {
        Write-Host "PASS: Element Found: $el" -ForegroundColor Green
    } else {
        Write-Host "FAIL: Missing Element: $el" -ForegroundColor Red
    }
}

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$testUrl = "file:///C:/Users/surabhi sonsale/.gemini/antigravity/scratch/health-anomaly-radar/tests/test_runner.html"

$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = $edgePath
$processInfo.Arguments = "--headless=new --dump-dom `"$testUrl`""
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $processInfo
$process.Start() | Out-Null
$stdout = $process.StandardOutput.ReadToEnd()
$process.WaitForExit(10000)

Write-Host "Detailed Test Results:" -ForegroundColor Yellow
$pattern = '(?s)<div class="space-y-1">.*?<span class="font-bold text-\[#263858\]">(.*?)</span>.*?<div class="text-\[#64748B\] pl-1 font-mono text-\[11px\]">(.*?)</div>.*?<div class="font-mono font-bold (.*?)">(.*?)</div>'
$matches = [regex]::Matches($stdout, $pattern)
foreach ($m in $matches) {
    $title = $m.Groups[1].Value.Trim()
    $detail = $m.Groups[2].Value.Trim()
    $status = $m.Groups[4].Value.Trim()
    $color = if ($status -match "Validated") { "Green" } else { "Red" }
    Write-Host "$status : $title - $detail" -ForegroundColor $color
}

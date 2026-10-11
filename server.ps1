# Real-Time Wearable Health Anomaly Radar
# Lightweight High-Performance PowerShell HTTP Server

param(
    [int]$Port = 8080
)

$HostAddress = "http://localhost:$Port/"
$RootPath = $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  REAL-TIME WEARABLE HEALTH ANOMALY RADAR - LOCAL SERVER  " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Root Directory: $RootPath" -ForegroundColor Gray
Write-Host "Listening at  : $HostAddress" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Gray
Write-Host ""

$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add($HostAddress)

try {
    $Listener.Start()
} catch {
    Write-Warning "Port $Port is in use or blocked. Trying port 8085..."
    $Port = 8085
    $HostAddress = "http://localhost:$Port/"
    $Listener = New-Object System.Net.HttpListener
    $Listener.Prefixes.Add($HostAddress)
    $Listener.Start()
}

Write-Host "Server successfully started on $HostAddress" -ForegroundColor Green

# Comprehensive MIME mapping
$MimeTypes = @{
    ".html"  = "text/html; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".js"    = "application/javascript; charset=utf-8"
    ".json"  = "application/json; charset=utf-8"
    ".png"   = "image/png"
    ".svg"   = "image/svg+xml"
    ".ico"   = "image/x-icon"
    ".woff"  = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"   = "font/ttf"
}

while ($Listener.IsListening) {
    try {
        $Context = $Listener.GetContext()
        $Request = $Context.Request
        $Response = $Context.Response

        # Add CORS Headers
        $Response.AddHeader("Access-Control-Allow-Origin", "*")
        $Response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $Response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

        if ($Request.HttpMethod -eq "OPTIONS") {
            $Response.StatusCode = 200
            $Response.OutputStream.Close()
            continue
        }

        $UrlPath = $Request.Url.LocalPath
        if ($UrlPath -eq "/" -or [string]::IsNullOrWhiteSpace($UrlPath)) {
            $UrlPath = "/index.html"
        }

        $FilePath = Join-Path $RootPath ($UrlPath.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar))

        if (Test-Path $FilePath -PathType Leaf) {
            $Ext = [IO.Path]::GetExtension($FilePath).ToLower()
            $ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { "application/octet-stream" }

            $Bytes = [IO.File]::ReadAllBytes($FilePath)
            $Response.ContentType = $ContentType
            $Response.ContentLength64 = $Bytes.Length
            $Response.StatusCode = 200
            $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
        } else {
            $Response.StatusCode = 404
            $NotFoundBytes = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $Response.OutputStream.Write($NotFoundBytes, 0, $NotFoundBytes.Length)
        }
        $Response.OutputStream.Close()
    } catch {
        # Gracefully handle client disconnects
    }
}

param(
    [Parameter(Mandatory = $true)]
    [string]$ApkPath
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path -LiteralPath $ApkPath)) {
    throw "APK file not found: $ApkPath"
}

Write-Host "[1/4] Extracting and decoding APK assets..." -ForegroundColor Cyan
node "$root\scripts\extract_apk.js" $ApkPath

Write-Host "[2/4] Generating item catalog..." -ForegroundColor Cyan
node "$root\scripts\build_catalog.js"

Write-Host "[3/4] Compiling native Windows host (CityStory.exe)..." -ForegroundColor Cyan
dotnet build "$root\native\CityStory.csproj" -c Release -o "$root\dist"

Write-Host "[4/4] Assembling portable dist/ bundle..." -ForegroundColor Cyan
if (Test-Path "$root\dist\web") {
    Remove-Item "$root\dist\web" -Recurse -Force
}
Copy-Item "$root\web" "$root\dist\web" -Recurse -Force
if (Test-Path "$root\native\app.ico") {
    Copy-Item "$root\native\app.ico" "$root\dist\app.ico" -Force
}

Write-Host ""
Write-Host "Build complete! Launch your game:" -ForegroundColor Green
Write-Host "  $root\dist\CityStory.exe" -ForegroundColor Yellow

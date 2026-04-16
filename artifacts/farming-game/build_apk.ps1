# Build APK Script for Lifetopia

param(
    [string]$BuildType = "debug"
)

$ErrorActionPreference = "Stop"
$projectDir = $PSScriptRoot

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Building Lifetopia APK..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Step 1: Install dependencies
Write-Host "`n[1/4] Installing npm dependencies..." -ForegroundColor Yellow
Set-Location $projectDir
npm install

# Step 2: Build web app
Write-Host "`n[2/4] Building web app..." -ForegroundColor Yellow
npm run build

# Step 3: Copy web build to android
Write-Host "`n[3/4] Syncing to Android..." -ForegroundColor Yellow
npx cap sync android

# Step 4: Build APK
Write-Host "`n[4/4] Building APK..." -ForegroundColor Yellow
Set-Location "$projectDir\android"

if ($BuildType -eq "release") {
    Write-Host "Building release APK (unsigned for testing)..." -ForegroundColor Cyan
    .\gradlew.bat assembleRelease
    $apkPath = "app\build\outputs\apk\release\app-release.apk"
} else {
    Write-Host "Building debug APK..." -ForegroundColor Cyan
    .\gradlew.bat assembleDebug
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
}

if (Test-Path $apkPath) {
    $apkSize = (Get-Item $apkPath).Length / 1MB
    Write-Host "`n================================================" -ForegroundColor Green
    Write-Host "BUILD SUCCESS!" -ForegroundColor Green
    Write-Host "APK: $apkPath" -ForegroundColor Green
    Write-Host "Size: $([math]::Round($apkSize, 2)) MB" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    
    # Copy to project root
    Copy-Item $apkPath "$projectDir\Lifetopia-$BuildType.apk" -Force
    Write-Host "Copied to: $projectDir\Lifetopia-$BuildType.apk" -ForegroundColor Cyan
} else {
    Write-Host "ERROR: APK not found at $apkPath" -ForegroundColor Red
    exit 1
}
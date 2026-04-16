#!/usr/bin/env pwsh
# build_apk_fixed.ps1 — Build Lifetopia APK with Capacitor (fixed blank screen)
# Run from: artifacts/farming-game/
# Requirements: Node.js, pnpm/npm, Java 17+, Android SDK

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "=== Lifetopia APK Build ===" -ForegroundColor Cyan

# 1. Install deps
Write-Host "[1/5] Installing dependencies..." -ForegroundColor Yellow
npm install

# 2. Build web with Capacitor base path
Write-Host "[2/5] Building web (Capacitor mode, base='./')..." -ForegroundColor Yellow
$env:CAPACITOR_BUILD = "1"
npm run build

# 3. Sync to Android
Write-Host "[3/5] Syncing to Android..." -ForegroundColor Yellow
npx cap sync android

# 4. Build debug APK
Write-Host "[4/5] Building debug APK..." -ForegroundColor Yellow
Push-Location android
if ($IsWindows -or $env:OS -eq "Windows_NT") {
    .\gradlew.bat assembleDebug
} else {
    ./gradlew assembleDebug
}
Pop-Location

# 5. Copy APK to root
Write-Host "[5/5] Copying APK..." -ForegroundColor Yellow
$apkSrc = "android/app/build/outputs/apk/debug/app-debug.apk"
$apkDst = "Lifetopia-debug.apk"
if (Test-Path $apkSrc) {
    Copy-Item $apkSrc $apkDst -Force
    Write-Host "APK ready: $apkDst" -ForegroundColor Green
} else {
    Write-Host "APK not found at $apkSrc" -ForegroundColor Red
    exit 1
}

Write-Host "=== Build complete ===" -ForegroundColor Cyan

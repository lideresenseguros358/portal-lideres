# Test script for Cron Jobs
# PowerShell version

$SECRET = "Lissa806CronSecret2025"
$BASE_URL = "http://localhost:3000"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TESTING CRON JOBS - Módulo de Casos" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Cases Cleanup
Write-Host "[1/3] Testing cases-cleanup..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod `
        -Uri "$BASE_URL/api/cron/cases-cleanup" `
        -Method Get `
        -Headers @{ "Authorization" = "Bearer $SECRET" } `
        -ContentType "application/json"
    
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "--------------------------------------------" -ForegroundColor Gray
Write-Host ""

# Test 2: Cases Reminders
Write-Host "[2/3] Testing cases-reminders..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod `
        -Uri "$BASE_URL/api/cron/cases-reminders" `
        -Method Get `
        -Headers @{ "Authorization" = "Bearer $SECRET" } `
        -ContentType "application/json"
    
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "--------------------------------------------" -ForegroundColor Gray
Write-Host ""

# Test 3: Cases Daily Digest
Write-Host "[3/3] Testing cases-daily-digest..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod `
        -Uri "$BASE_URL/api/cron/cases-daily-digest" `
        -Method Get `
        -Headers @{ "Authorization" = "Bearer $SECRET" } `
        -ContentType "application/json"
    
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TESTS COMPLETED" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para ver notificaciones generadas:" -ForegroundColor Yellow
Write-Host "  Ve a Supabase → SQL Editor y ejecuta:" -ForegroundColor Gray
Write-Host "  SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;" -ForegroundColor Gray
Write-Host ""

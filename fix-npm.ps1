# Скрипт для налаштування npm в PowerShell
# Запустіть: .\fix-npm.ps1

Write-Host "=== Налаштування npm для PowerShell ===" -ForegroundColor Cyan
Write-Host ""

# Знаходимо профіль PowerShell
$profilePath = $PROFILE.CurrentUserAllHosts
if (-not $profilePath) {
    $profilePath = "$env:USERPROFILE\Documents\PowerShell\Microsoft.PowerShell_profile.ps1"
}

$profileDir = Split-Path -Parent $profilePath

# Створюємо директорію профілю, якщо не існує
if (-not (Test-Path $profileDir)) {
    Write-Host "Створення директорії профілю..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Функція для npm
$npmFunction = @"

# Функція-обгортка для npm (обходить проблеми з політикою виконання)
function npm {
    if (`$args.Count -eq 0) {
        & npm.cmd
    } else {
        & npm.cmd @args
    }
}

"@

# Перевіряємо, чи функція вже існує
if (Test-Path $profilePath) {
    $content = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
    if ($content -and $content -match "function npm") {
        Write-Host "✓ Функція npm вже існує в профілі" -ForegroundColor Green
    } else {
        Add-Content -Path $profilePath -Value "`n$npmFunction"
        Write-Host "✓ Функцію npm додано до профілю" -ForegroundColor Green
    }
} else {
    Set-Content -Path $profilePath -Value $npmFunction
    Write-Host "✓ Створено профіль з функцією npm" -ForegroundColor Green
}

Write-Host ""
Write-Host "Шлях до профілю: $profilePath" -ForegroundColor Cyan
Write-Host ""
Write-Host "=== Готово! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Перезапустіть PowerShell або виконайте:" -ForegroundColor Yellow
Write-Host "  . `$PROFILE" -ForegroundColor White
Write-Host ""
Write-Host "Після цього команда 'npm' буде працювати!" -ForegroundColor Cyan
Write-Host ""


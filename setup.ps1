# Скрипт налаштування проекту Twitter Extractor
# PowerShell скрипт для автоматичного встановлення залежностей

Write-Host "=== Twitter Data Extractor - Setup ===" -ForegroundColor Cyan
Write-Host ""

# Перевірка Node.js
Write-Host "Перевірка Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js встановлено: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js НЕ встановлено!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Будь ласка, встановіть Node.js:" -ForegroundColor Yellow
    Write-Host "1. Відкрийте https://nodejs.org/" -ForegroundColor White
    Write-Host "2. Завантажте LTS версію" -ForegroundColor White
    Write-Host "3. Встановіть і перезапустіть термінал" -ForegroundColor White
    Write-Host ""
    Write-Host "Після встановлення Node.js, запустіть цей скрипт знову." -ForegroundColor Yellow
    exit 1
}

# Перевірка npm
Write-Host "Перевірка npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✓ npm встановлено: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm НЕ знайдено!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Перевірка наявності .env файлу
if (-not (Test-Path ".env")) {
    Write-Host "Створення .env файлу..." -ForegroundColor Yellow
    $envContent = @"
# Twitter API Credentials
# Fill in your credentials below

# Option 1: Use Bearer Token (simpler, but limited functionality)
TWITTER_BEARER_TOKEN=your_bearer_token_here

# Option 2: Use OAuth 1.0a (required for likes and full access)
# Uncomment and fill in these if using OAuth instead of Bearer Token:
# TWITTER_API_KEY=your_api_key_here
# TWITTER_API_SECRET=your_api_secret_here
# TWITTER_ACCESS_TOKEN=your_access_token_here
# TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here

# Note: Only use ONE method (Bearer Token OR OAuth, not both)
"@
    Set-Content -Path ".env" -Value $envContent
    Write-Host "✓ Файл .env створено" -ForegroundColor Green
    Write-Host "⚠ Не забудьте заповнити ваші Twitter API credentials в .env файлі!" -ForegroundColor Yellow
} else {
    Write-Host "✓ Файл .env вже існує" -ForegroundColor Green
}

Write-Host ""

# Перевірка node_modules
if (Test-Path "node_modules") {
    Write-Host "Перевірка залежностей..." -ForegroundColor Yellow
    Write-Host "✓ node_modules вже існує" -ForegroundColor Green
    Write-Host "Якщо потрібно оновити залежності, виконайте: npm install" -ForegroundColor Cyan
} else {
    Write-Host "Встановлення залежностей..." -ForegroundColor Yellow
    Write-Host "Це може зайняти 5-10 хвилин (Puppeteer завантажує Chromium ~300MB)..." -ForegroundColor Cyan
    Write-Host ""
    
    npm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Всі залежності успішно встановлено!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "✗ Помилка при встановленні залежностей" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "=== Налаштування завершено! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Наступні кроки:" -ForegroundColor Cyan
Write-Host "1. Відкрийте файл .env і заповніть ваші Twitter API credentials" -ForegroundColor White
Write-Host "2. Запустіть проект: npm start `"URL_ТВІТУ`"" -ForegroundColor White
Write-Host ""
Write-Host "Приклад:" -ForegroundColor Yellow
Write-Host '  npm start "https://x.com/username/status/1234567890"' -ForegroundColor White
Write-Host ""


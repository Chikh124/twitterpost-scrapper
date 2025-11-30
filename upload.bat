@echo off
chcp 65001 >nul
echo ========================================
echo Завантаження на GitHub
echo ========================================
echo.
echo Репозиторій: Chikh124/twitterpost-scrapper
echo.

REM Check if git is installed
where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git не встановлено!
    echo Завантажте Git: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo [1/5] Ініціалізація git репозиторію...
if not exist .git (
    git init
) else (
    echo Git вже ініціалізовано
)

echo.
echo [2/5] Додавання файлів...
git add .

echo.
echo [3/5] Створення commit...
git commit -m "Add Twitter/X data extractor project" 2>nul
if errorlevel 1 (
    echo Попередження: Можливо, немає змін для commit
)

echo.
echo [4/5] Налаштування remote...
git remote remove origin 2>nul
git remote add origin https://github.com/Chikh124/twitterpost-scrapper.git

echo.
echo [5/5] Завантаження на GitHub...
git branch -M main

REM Try to pull first if remote has files
echo Перевірка remote репозиторію...
git pull origin main --allow-unrelated-histories --no-edit 2>nul
if errorlevel 1 (
    echo Remote має файли, об'єдную зміни...
    git pull origin main --allow-unrelated-histories
    git add .
    git commit -m "Merge remote and local changes" 2>nul
)

git push -u origin main

echo.
echo ========================================
if errorlevel 1 (
    echo [ПОМИЛКА] Завантаження не вдалося
    echo.
    echo Можливі причини:
    echo 1. Потрібна авторизація (Personal Access Token)
    echo 2. Репозиторій вже має файли (потрібен git pull)
    echo.
    echo Дивіться UPLOAD_TO_GITHUB.md для деталей
) else (
    echo [УСПІХ] Проект завантажено на GitHub!
    echo.
    echo Відкрийте: https://github.com/Chikh124/twitterpost-scrapper
)

echo.
pause


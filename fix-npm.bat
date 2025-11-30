@echo off
chcp 65001 >nul
echo === Налаштування npm для PowerShell ===
echo.
echo Запуск PowerShell скрипта...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0fix-npm.ps1"
echo.
echo Натисніть будь-яку клавішу для виходу...
pause >nul


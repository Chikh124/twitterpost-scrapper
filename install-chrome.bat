@echo off
echo Installing Chrome for Puppeteer...
echo.
echo This will download Chrome browser for Puppeteer to use.
echo.
call npx puppeteer browsers install chrome
echo.
echo Done! Try running npm start again.
pause


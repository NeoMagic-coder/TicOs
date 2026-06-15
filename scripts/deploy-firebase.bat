@echo off
setlocal
cd /d "%~dp0.."

echo ========================================
echo  TicOSClaw Firebase Deploy
echo ========================================
echo.
echo Adim 1: Firebase hesabi (tarayici acilir)
firebase login
if errorlevel 1 goto :error

echo.
echo Adim 2: Production build
cd frontend
if not exist ".env.production" copy ".env.example" ".env.production"
call npm run build
cd ..

echo.
echo Adim 3: Hosting deploy
firebase deploy --only hosting --project ticosclaw
if errorlevel 1 goto :error

echo.
echo Basarili: https://ticosclaw.web.app
pause
exit /b 0

:error
echo.
echo Deploy tamamlanamadi. Yukaridaki hatayi kontrol edin.
pause
exit /b 1

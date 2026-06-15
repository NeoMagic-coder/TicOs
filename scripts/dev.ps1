@echo off
setlocal
cd /d "%~dp0.."

if not exist "backend\.venv" (
  echo [dev] venv olusturuluyor...
  python -m venv backend\.venv
  backend\.venv\Scripts\python.exe -m pip install -r backend\apps\api\requirements.txt -q
)

if not exist "frontend\node_modules" (
  echo [dev] npm install...
  cd frontend && call npm install && cd ..
)

if not exist "frontend\.env" copy "frontend\.env.example" "frontend\.env"

echo [dev] API  -> http://localhost:8000
start "TicOSClaw API" cmd /k "cd /d %CD%\backend && .venv\Scripts\python.exe -m uvicorn apps.api.main:app --reload --port 8000"

echo [dev] Web  -> http://localhost:5173
start "TicOSClaw Web" cmd /k "cd /d %CD%\frontend && npm run dev"

echo.
echo Her iki sunucu ayri pencerede baslatildi.
echo Firebase Console: Authentication ^> Sign-in method ^> Google ^> Enable
echo   https://console.firebase.google.com/project/ticosclaw/authentication/providers

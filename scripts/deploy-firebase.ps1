@echo off
setlocal
cd /d "%~dp0.."

echo [1/4] Backend bagimliliklari...
if not exist "backend\.venv" (
  python -m venv backend\.venv
)
backend\.venv\Scripts\python.exe -m pip install -r backend\apps\api\requirements.txt -q

echo [2/4] Frontend build...
if not exist "frontend\.env" copy "frontend\.env.example" "frontend\.env"
cd frontend
call npm install --no-audit --no-fund
call npm run build
cd ..

echo [3/4] Firebase CLI...
where firebase >nul 2>&1
if errorlevel 1 (
  call npm install -g firebase-tools
)

echo [4/4] Firebase deploy...
firebase login:list | findstr /C:"No authorized accounts" >nul
if not errorlevel 1 (
  echo.
  echo Firebase hesabi bagli degil. Tarayici acilacak — Google ile giris yapin:
  firebase login
)

firebase deploy --only hosting --project ticosclaw
echo.
echo Tamamlandi: https://ticosclaw.web.app

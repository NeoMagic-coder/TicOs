@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

set PROJECT_ID=ticosclaw
set REGION=europe-west1
set SERVICE=ticosclaw-api
set IMAGE=%REGION%-docker.pkg.dev/%PROJECT_ID%/ticosclaw/%SERVICE%:latest

echo ========================================
echo  TicOSClaw API - Cloud Run Deploy
echo ========================================
echo.

where gcloud >nul 2>&1
if errorlevel 1 (
  echo Google Cloud SDK bulunamadi.
  echo Kurulum: winget install Google.CloudSDK
  echo Sonra bu scripti tekrar calistirin.
  exit /b 1
)

if not exist "docker\cloudrun.env.yaml" (
  echo docker\cloudrun.env.yaml yok — ornekten kopyalaniyor...
  copy "docker\cloudrun.env.yaml.example" "docker\cloudrun.env.yaml" >nul
  echo Lutfen docker\cloudrun.env.yaml icinde AUTH_SESSION_SECRET gibi degerleri guncelleyin.
)

echo [1/6] Proje: %PROJECT_ID%
gcloud config set project %PROJECT_ID%
if errorlevel 1 goto :error

echo [2/6] API'ler aciliyor...
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
if errorlevel 1 goto :error

echo [3/6] Artifact Registry...
gcloud artifacts repositories describe ticosclaw --location=%REGION% >nul 2>&1
if errorlevel 1 (
  gcloud artifacts repositories create ticosclaw --repository-format=docker --location=%REGION% --description="TicOSClaw containers"
)

echo [4/6] Docker image build ^(Cloud Build^)...
gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=%REGION%,_TAG=latest .
if errorlevel 1 goto :error

echo [5/6] Cloud Run deploy...
gcloud run deploy %SERVICE% ^
  --image %IMAGE% ^
  --region %REGION% ^
  --platform managed ^
  --allow-unauthenticated ^
  --port 8000 ^
  --memory 1Gi ^
  --cpu 1 ^
  --min-instances 0 ^
  --max-instances 3 ^
  --env-vars-file docker/cloudrun.env.yaml
if errorlevel 1 goto :error

echo [6/6] Firebase Hosting ^(API proxy + frontend^)...
cd frontend
call npm run build
cd ..
firebase deploy --only hosting --project %PROJECT_ID%
if errorlevel 1 goto :error

echo.
echo Tamamlandi!
echo   Site:  https://ticosclaw.web.app
echo   API:   https://ticosclaw.web.app/api/v1/health
echo   Cloud: https://console.cloud.google.com/run/detail/%REGION%/%SERVICE%?project=%PROJECT_ID%
exit /b 0

:error
echo.
echo Deploy tamamlanamadi. Yukaridaki hatayi kontrol edin.
echo Not: Google Cloud faturalandirma acik olmali.
exit /b 1

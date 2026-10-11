@echo off
title Saber 11 - Preparacion
echo ============================================
echo   SABER 11 - iniciando servidor...
echo   Deja esta ventana abierta.
echo   La app queda en: http://localhost:5180
echo ============================================
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No encuentro Node.js. Instalalo desde https://nodejs.org (version LTS) y vuelve a abrir este archivo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando dependencias por primera vez...
  call npm install
)
if not exist .env.local (
  echo Creando .env.local con la conexion a la nube ^(claves publicas^)...
  (
    echo VITE_SUPABASE_URL=https://momifbunzatimmhceohs.supabase.co
    echo VITE_SUPABASE_ANON_KEY=sb_publishable_zgOdGFF-rxuYkVDYNwpp4A_GYRFoKtO
  ) > .env.local
)
start "" "http://localhost:5180"
call npm run dev -- --port 5180
pause

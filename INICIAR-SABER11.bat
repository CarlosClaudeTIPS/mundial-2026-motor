@echo off
title Saber 11 - Preparacion
echo ============================================
echo   SABER 11 - iniciando servidor...
echo   Deja esta ventana abierta.
echo   La app queda en: http://localhost:5180
echo ============================================
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
if not exist node_modules (
  echo Instalando dependencias por primera vez...
  call npm install
)
start "" "http://localhost:5180"
call npm run dev -- --port 5180
pause

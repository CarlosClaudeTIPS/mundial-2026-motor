@echo off
title Motor de Apuestas
echo ============================================
echo   MOTOR DE APUESTAS - iniciando servidor...
echo   Deja esta ventana abierta.
echo   La app queda en: http://localhost:5175
echo ============================================
cd /d "%~dp0"
start "" "http://localhost:5175"
call npm run dev -- --port 5175
pause

@echo off
REM Arma el portal unificado y lo abre en el navegador (Windows)
cd /d "%~dp0"
if not exist saber11-prep\node_modules (
  echo Instalando dependencias del ICFES (solo la primera vez)...
  cd saber11-prep && call npm ci && cd ..
)
set BASE=./
node portal\build.mjs
start http://localhost:8090
cd portal\dist
python -m http.server 8090

@echo off
chcp 65001 >nul
title Iniciar VetYa
cd /d "%~dp0"

if not exist "backend\.env" (
  echo.
  echo VetYa todavia no esta instalado en esta computadora. Primero hace doble clic en instalar.bat
  echo.
  pause
  exit /b 1
)

echo Abriendo VetYa... Se abren dos ventanas negras: no las cierres mientras lo uses.
start "VetYa - servidor (no cerrar)" cmd /k "npm --prefix backend run dev"
start "VetYa - pagina (no cerrar)" cmd /k "npm --prefix frontend run dev"

rem Se espera unos segundos a que arranquen y se abre el navegador.
timeout /t 8 /nobreak >nul
start "" http://localhost:5173

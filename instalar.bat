@echo off
chcp 65001 >nul
title Instalar VetYa
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Falta instalar Node.js. Descargalo de https://nodejs.org ^(version LTS^), instalalo y volve a abrir este archivo.
  echo.
  pause
  exit /b 1
)

node herramientas\instalar.mjs
echo.
pause

@echo off
setlocal
cd /d "%~dp0"
title Saarly Landing Page

echo.
echo ==========================================
echo   Saarly Landing Page - Local Preview
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not available in PATH.
  pause
  exit /b 1
)

if not exist node_modules\next\package.json (
  echo Installing project packages for the first time...
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: Package installation failed.
    pause
    exit /b 1
  )
)

echo Starting a clean development server...
echo Open: http://localhost:3100
start "" "http://localhost:3100"
call npm run dev

echo.
echo The development server has stopped.
pause

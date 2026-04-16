@echo off
setlocal
cd /d "%~dp0"
node build.js
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b %errorlevel%
)
exit /b 0

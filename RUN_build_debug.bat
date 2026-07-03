@echo off
setlocal
cd /d "%~dp0"
node build.js --debug
if errorlevel 1 (
  echo.
  echo Debug build failed.
  pause
  exit /b %errorlevel%
)
exit /b 0

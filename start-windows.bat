@echo off
cd /d %~dp0
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
if not exist .env.local (
  echo.
  echo ERROR: .env.local is missing.
  echo Copy .env.example to .env.local and add DATABASE_URL first.
  pause
  exit /b 1
)
echo Starting NutreeNext Billing at http://localhost:3000
call npm run dev

@echo off
rem Escritorio Virtual - inicio rapido (duplo clique no atalho). Liga o servidor em segundo plano e abre a Sala 3D.
rem Se ele ja estiver ligado, so abre a Sala. Para desligar: feche a janelinha "Prospector - servidor" na barra de tarefas.
rem Primeira vez, ou depois de formatar o PC: rode instalacao.bat (confere tudo e cria o .env).
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Rode instalacao.bat para ver o que falta.
  pause
  exit /b 1
)

set PORT=4300
if exist .env for /f "tokens=2 delims==" %%a in ('findstr /b /c:"PORT=" .env') do set PORT=%%a

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  start "Prospector - servidor (feche para desligar)" /min cmd /c "node src\server.mjs & pause"
  powershell -NoProfile -Command "for($i=0;$i -lt 40;$i++){ if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 0 }; Start-Sleep -Milliseconds 500 }; exit 1"
  if errorlevel 1 (
    echo O servidor nao subiu em 20 segundos. Rode instalacao.bat para ver o motivo.
    pause
    exit /b 1
  )
)

start "" "http://127.0.0.1:%PORT%/sala.html"

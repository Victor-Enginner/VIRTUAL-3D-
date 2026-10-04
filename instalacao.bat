@echo off
rem Prospector - instalacao e inicializacao completa da sala (Windows).
rem Duplo clique: confere o computador, cria o .env, pergunta antes de instalar qualquer coisa,
rem sobe o servidor e abre a Sala 3D. Para so conferir, sem iniciar:  instalacao.bat /checar
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Prospector

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e rode de novo.
  echo.
  pause
  exit /b 1
)

if /i "%~1"=="/checar" (
  node scripts\instalar.mjs --checar
  exit /b %errorlevel%
)

node scripts\instalar.mjs
if errorlevel 1 (
  echo.
  echo  Corrija os itens marcados FALTA acima e rode de novo.
  pause
  exit /b 1
)

rem atalho com icone na Area de Trabalho e nesta pasta (so pergunta se ainda nao existe)
if not exist "%~dp0*rio Virtual.lnk" (
  set /p ATALHO=Criar o atalho do Escritorio Virtual na Area de Trabalho? [s/N] 
  if /i "%ATALHO%"=="s" powershell -NoProfile -ExecutionPolicy Bypass -File scripts\criar-atalhos.ps1
)

rem porta do .env (padrao 4300)
set PORT=4300
if exist .env for /f "tokens=2 delims==" %%a in ('findstr /b /c:"PORT=" .env') do set PORT=%%a

rem o Ollama so liga se voce disser que sim (so a escrita das mensagens precisa dele)
set OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe
if exist "%OLLAMA_EXE%" (
  set /p LIGAR=Ligar o Ollama agora para a Nova e a Maia usarem o modelo? [s/N]
  if /i "%LIGAR%"=="s" start "Ollama" /min "%OLLAMA_EXE%" serve
)

echo.
echo  Iniciando o Prospector em http://127.0.0.1:%PORT%  (feche esta janela para desligar)
start "" cmd /c "timeout /t 3 >nul & start "" http://127.0.0.1:%PORT%/sala.html"
node src\server.mjs
echo.
echo  O servidor parou. Veja a mensagem acima.
pause

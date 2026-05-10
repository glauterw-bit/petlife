@echo off
title PetLife - Instalacao
color 0B

echo ============================================
echo     PETLIFE - Instalacao Completa
echo ============================================
echo.

REM ---- BACKEND ----
echo [BACKEND] Configurando ambiente Python...
cd /d "%~dp0backend"

if not exist "venv" (
    echo Criando ambiente virtual...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo ERRO ao criar ambiente virtual. Python 3.11+ necessario.
        pause
        exit /b 1
    )
)

echo Ativando ambiente virtual...
call venv\Scripts\activate.bat

echo Instalando dependencias Python...
pip install --upgrade pip -q
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERRO ao instalar dependencias Python.
    pause
    exit /b 1
)

echo Backend configurado com sucesso!
echo.

REM ---- FRONTEND ----
echo [FRONTEND] Instalando dependencias Node.js...
cd /d "%~dp0frontend"

if not exist "node_modules" (
    npm install
    if %errorlevel% neq 0 (
        echo ERRO ao instalar dependencias Node.js.
        pause
        exit /b 1
    )
)

echo Frontend configurado com sucesso!
echo.

REM ---- CONFIGURACAO ----
echo [CONFIG] Verifique o arquivo backend\.env
echo         Adicione sua ANTHROPIC_API_KEY para habilitar recursos de IA
echo.

echo ============================================
echo  Instalacao concluida!
echo  Execute iniciar.bat para iniciar o sistema
echo ============================================
echo.
pause

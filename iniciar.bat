@echo off
title PetLife - Sistema de Gestao de Pets
color 0A

echo ============================================
echo       PETLIFE - Iniciando o Sistema
echo ============================================
echo.
echo [1/3] Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Python nao encontrado. Instale Python 3.11+
    pause
    exit /b 1
)

echo [2/3] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado. Instale Node.js 18+
    pause
    exit /b 1
)

echo [3/3] Iniciando servicos...
echo.

REM Instalar dependencias do backend se necessario
cd /d "%~dp0backend"
if not exist "venv" (
    echo Criando ambiente virtual Python...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo Instalando dependencias Python...
pip install -r requirements.txt -q

REM Instalar dependencias do frontend se necessario
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo Instalando dependencias Node.js...
    npm install
)

echo.
echo ============================================
echo  Iniciando Backend  (porta 8030)...
echo  Iniciando Frontend (porta 3030)...
echo ============================================
echo.

REM Iniciar backend em nova janela
start "PetLife - Backend (8030)" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && python main.py"

REM Aguardar 3 segundos para o backend iniciar
timeout /t 3 /nobreak >nul

REM Iniciar frontend em nova janela
start "PetLife - Frontend (3030)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ============================================
echo  PetLife iniciado com sucesso!
echo.
echo  Backend:  http://localhost:8030
echo  Docs API: http://localhost:8030/docs
echo  Frontend: http://localhost:3030
echo ============================================
echo.
echo Aguardando 5 segundos para abrir o navegador...
timeout /t 5 /nobreak >nul

start http://localhost:3030

echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul

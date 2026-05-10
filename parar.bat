@echo off
title PetLife - Parando servicos
echo Parando PetLife (portas 8030 e 3030)...

for /f "tokens=5" %%a in ('netstat -aon ^| find ":8030" ^| find "LISTENING"') do (
    echo Encerrando processo na porta 8030 (PID: %%a)
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| find ":3030" ^| find "LISTENING"') do (
    echo Encerrando processo na porta 3030 (PID: %%a)
    taskkill /f /pid %%a >nul 2>&1
)

echo PetLife encerrado.
timeout /t 2 >nul

@echo off
REM Script para iniciar o servidor HTTP automaticamente
REM Coloque este arquivo em C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup

cd /d "C:\Users\marcelo.cortez\OneDrive - MINISTERIO DA JUSTICA\1. SENAPPEN\2. OUVIDORIA\GITHUB\FOMENTO-ONASP"

REM Aguarda um pouco para garantir que o sistema iniciou corretamente
timeout /t 5

REM Inicia o servidor Node.js em uma nova janela
start "FOMENTO-ONASP Server" cmd /k npm start

REM Abre o navegador na página desejada (aguarda o servidor ficar pronto)
timeout /t 5
start http://127.0.0.1:8790/index.html

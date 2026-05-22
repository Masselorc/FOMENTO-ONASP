# Script PowerShell para iniciar o servidor automaticamente ao ligar o computador
# Este arquivo requer que você execute "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser"

# Caminho do projeto
$projectPath = "C:\Users\marcelo.cortez\OneDrive - MINISTERIO DA JUSTICA\1. SENAPPEN\2. OUVIDORIA\GITHUB\FOMENTO-ONASP"

# Aguarda um pouco para garantir que o sistema iniciou corretamente
Start-Sleep -Seconds 5

# Muda para o diretório do projeto
Set-Location -Path $projectPath

# Inicia o servidor Node.js
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/k npm start"

# Aguarda o servidor inicializar
Start-Sleep -Seconds 5

# Abre o navegador
Start-Process "http://127.0.0.1:8790/index.html"

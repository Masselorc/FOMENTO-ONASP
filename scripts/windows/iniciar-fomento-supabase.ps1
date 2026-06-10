$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$poolerPath = Join-Path $repoRoot "supabase\.temp\pooler-url"
$logDir = Join-Path $repoRoot "logs"
$logPath = Join-Path $logDir "launcher-supabase.log"
$urlAplicacao = "http://127.0.0.1:8790/index.html"

function Write-LauncherLog {
  param([string]$Message)
  if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
  }
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logPath -Value "[$timestamp] $Message"
}

function Convert-SecureStringToPlainText {
  param([securestring]$SecureString)
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Test-ServidorLocal {
  try {
    $response = Invoke-WebRequest -Uri $urlAplicacao -UseBasicParsing -TimeoutSec 3
    return [int]$response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Open-Chrome {
  $chromePaths = @(
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe")
  )
  $chrome = $chromePaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList $urlAplicacao
    return
  }
  Start-Process $urlAplicacao
}

Set-Location $repoRoot
Write-LauncherLog "Acionador iniciado."

if (-not (Test-Path $poolerPath)) {
  Write-LauncherLog "Falha: supabase/.temp/pooler-url nao encontrado."
  throw "Arquivo supabase/.temp/pooler-url nao encontrado. Sincronize/vincule o projeto Supabase antes de iniciar."
}

if (Test-ServidorLocal) {
  Write-LauncherLog "Servidor ja estava respondendo em 127.0.0.1:8790. Abrindo Chrome."
  Open-Chrome
  exit 0
}

$securePassword = Read-Host "Digite a senha do banco Supabase" -AsSecureString
$plainPassword = Convert-SecureStringToPlainText $securePassword
if ([string]::IsNullOrWhiteSpace($plainPassword)) {
  Write-LauncherLog "Falha: senha vazia."
  throw "Senha vazia. A aplicacao nao foi iniciada."
}

$pooler = (Get-Content $poolerPath -Raw).Trim()
$uri = [Uri]$pooler
$encodedPassword = [System.Uri]::EscapeDataString($plainPassword.Trim())
$databaseUrl = "postgresql://$($uri.UserInfo):$encodedPassword@$($uri.Host):$($uri.Port)$($uri.AbsolutePath)?sslmode=no-verify"

$env:DATABASE_URL = $databaseUrl
$env:HOST = "127.0.0.1"
$env:PORT = "8790"

Write-LauncherLog "Iniciando servidor Node local com conexao Supabase remota."
$serverOut = Join-Path $logDir "launcher-server.out.log"
$serverErr = Join-Path $logDir "launcher-server.err.log"

$process = Start-Process `
  -FilePath "node" `
  -ArgumentList "backend/server.js" `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $serverOut `
  -RedirectStandardError $serverErr `
  -PassThru

Write-LauncherLog "Processo servidor iniciado. PID=$($process.Id)."

$deadline = (Get-Date).AddSeconds(35)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 1
  if ($process.HasExited) {
    Write-LauncherLog "Falha: servidor encerrou antes de responder. PID=$($process.Id)."
    throw "Servidor encerrou antes de responder. Verifique logs/launcher-server.err.log."
  }
  if (Test-ServidorLocal) {
    Write-LauncherLog "Servidor respondeu HTTP 200. Abrindo Chrome."
    Open-Chrome
    exit 0
  }
}

Write-LauncherLog "Falha: timeout aguardando HTTP 200."
throw "Servidor iniciou, mas nao respondeu em 35 segundos. Verifique logs/launcher-server.err.log."

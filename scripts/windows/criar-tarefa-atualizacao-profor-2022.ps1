[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host $Message
}

function Resolve-ProjectRoot {
    $basePath = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    if (-not $basePath) {
        throw 'Nao foi possivel identificar o diretorio do script.'
    }

    $resolved = Resolve-Path (Join-Path $basePath '..\..') -ErrorAction Stop
    return $resolved.Path
}

try {
    $ProjectRoot = Resolve-ProjectRoot
    $PackageJsonPath = Join-Path $ProjectRoot 'package.json'
    $LogsDir = Join-Path $ProjectRoot 'logs'
    $LogFile = Join-Path $LogsDir 'atualizacao-profor-2022.log'
    $TaskName = 'ONASP - Atualizar PROFOR 2022'
    $ScheduleTime = '12:00'
    $TaskDescription = 'Atualiza o PROFOR 2022 diariamente ao meio-dia.'

    Write-Step "Raiz detectada: $ProjectRoot"

    if (-not (Test-Path -LiteralPath $PackageJsonPath -PathType Leaf)) {
        throw "package.json nao encontrado na raiz do projeto: $PackageJsonPath"
    }

    Write-Step "package.json localizado: $PackageJsonPath"

    $npmVersion = & npm --version 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($npmVersion | Out-String))) {
        throw 'npm nao esta disponivel no PATH. Execute o script em um ambiente com Node.js/npm instalados.'
    }

    Write-Step ("npm disponivel: {0}" -f (($npmVersion | Out-String).Trim()))

    if (-not (Test-Path -LiteralPath $LogsDir)) {
        New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
    }

    Write-Step "Pasta de logs: $LogsDir"

    $CmdInner = "cd /d `"$ProjectRoot`" && npm run atualizar:profor-2022 >> `"$LogFile`" 2>&1"
    $CommandToRun = "cmd.exe /c `"$CmdInner`""

    Write-Step "Nome da tarefa: $TaskName"
    Write-Step "Horario configurado: $ScheduleTime"
    Write-Step "Comando que sera executado: $CommandToRun"
    Write-Step "Arquivo de log: $LogFile"

    $Principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
    $Trigger = New-ScheduledTaskTrigger -Daily -At $ScheduleTime
    $Action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$CmdInner`""
    $Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

    $ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($ExistingTask) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Step 'Tarefa anterior removida para substituicao.'
    }

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Principal $Principal `
        -Settings $Settings `
        -Description $TaskDescription | Out-Null

    Write-Step 'Tarefa criada com sucesso.'
    Write-Step 'Comando para testar manualmente:'
    Write-Host "schtasks /Run /TN `"$TaskName`""
    Write-Host "schtasks /Query /TN `"$TaskName`" /V /FO LIST"
    Write-Host "schtasks /Delete /TN `"$TaskName`" /F"
}
catch {
    Write-Error $_
    exit 1
}

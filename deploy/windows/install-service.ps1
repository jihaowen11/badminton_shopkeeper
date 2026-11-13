#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Register the badminton API (node bin/www) as a Windows service using NSSM.

.DESCRIPTION
    - Runs node.exe as the service host, working directory = node\server
    - Restarts automatically on crash (3s delay)
    - Redirects stdout/stderr to logs\api-out.log / api-err.log with 10MB rotation
    - Gives the process 12s on stop so the built-in graceful shutdown can finish
    - Starts on boot

.PARAMETER Root
    Deployment root, default C:\apps\badminton. Holds logs\, backups\, nssm\.

.PARAMETER ServerDir
    Folder containing bin\www. Defaults to <Root>\repo\node\server.
    Pass this when the project lives somewhere else, e.g.
    C:\project\badminton_shopkeeper\node\node\server

.PARAMETER ServiceName
    Windows service name, default BadmintonAPI

.PARAMETER NodeExe
    Full path to node.exe. Auto-detected when omitted.

.PARAMETER NssmExe
    Full path to nssm.exe. Looks in <Root>\nssm\nssm.exe then PATH.

.EXAMPLE
    .\install-service.ps1 -Root C:\apps\badminton

.EXAMPLE
    .\install-service.ps1 -Root C:\project\badminton_shopkeeper -ServerDir C:\project\badminton_shopkeeper\node\node\server
#>
[CmdletBinding()]
param(
    [string]$Root = 'C:\apps\badminton',
    [string]$ServerDir,
    [string]$ServiceName = 'BadmintonAPI',
    [string]$NodeExe,
    [string]$NssmExe
)

$ErrorActionPreference = 'Stop'

function Resolve-Tool {
    param([string]$Explicit, [string[]]$Candidates, [string]$Name)

    if ($Explicit) {
        if (-not (Test-Path $Explicit)) { throw "$Name not found at $Explicit" }
        return $Explicit
    }
    foreach ($c in $Candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { return $cmd.Source }
    throw "$Name not found. Install it first or pass its full path."
}

if (-not $ServerDir) { $ServerDir = Join-Path $Root 'repo\node\server' }
$resolved = Resolve-Path $ServerDir -ErrorAction SilentlyContinue
if (-not $resolved) { throw "Server directory not found: $ServerDir" }
$ServerDir = $resolved.Path
$LogDir = Join-Path $Root 'logs'
$Www = Join-Path $ServerDir 'bin\www'

Write-Host "[1/5] Checking layout under $Root"

if (-not (Test-Path $Www)) {
    throw "Entry script not found: $Www"
}
if (-not (Test-Path (Join-Path $ServerDir 'node_modules'))) {
    throw "node_modules missing. Run: cd $ServerDir; npm ci --omit=dev"
}
if (-not (Test-Path (Join-Path $ServerDir '.env'))) {
    throw "Missing $ServerDir\.env . Copy repo\deploy\windows\env.production.example and fill it in."
}

$NodeExe = Resolve-Tool -Explicit $NodeExe -Candidates @(
    'C:\Program Files\nodejs\node.exe',
    'C:\Program Files (x86)\nodejs\node.exe'
) -Name 'node'

$NssmExe = Resolve-Tool -Explicit $NssmExe -Candidates @(
    (Join-Path $Root 'nssm\nssm.exe'),
    (Join-Path $Root 'nssm\win64\nssm.exe')
) -Name 'nssm'

Write-Host "      node : $NodeExe"
Write-Host "      nssm : $NssmExe"
Write-Host "      app  : $Www"

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
}

Write-Host "[2/5] Removing previous service if present"
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    & $NssmExe stop $ServiceName | Out-Null
    Start-Sleep -Seconds 2
    & $NssmExe remove $ServiceName confirm | Out-Null
    Start-Sleep -Seconds 1
}

Write-Host "[3/5] Registering service $ServiceName"
& $NssmExe install $ServiceName $NodeExe $Www | Out-Null
if ($LASTEXITCODE -ne 0) { throw "nssm install failed with code $LASTEXITCODE" }

$pairs = @(
    @('AppDirectory', $ServerDir),
    @('AppStdout', (Join-Path $LogDir 'api-out.log')),
    @('AppStderr', (Join-Path $LogDir 'api-err.log')),
    @('AppRotateFiles', '1'),
    @('AppRotateOnline', '1'),
    @('AppRotateBytes', '10485760'),
    @('AppStopMethodConsole', '12000'),
    @('AppStopMethodSkip', '0'),
    @('AppRestartDelay', '3000'),
    @('AppThrottle', '1500'),
    @('Start', 'SERVICE_AUTO_START'),
    @('DisplayName', 'Badminton API'),
    @('Description', 'Badminton shopkeeper backend - Koa2 on 127.0.0.1:3000')
)

foreach ($p in $pairs) {
    & $NssmExe set $ServiceName $p[0] $p[1] | Out-Null
}

# Extra environment on top of the .env file
& $NssmExe set $ServiceName AppEnvironmentExtra 'NODE_ENV=production' | Out-Null

Write-Host "[4/5] Starting service"
& $NssmExe start $ServiceName | Out-Null
Start-Sleep -Seconds 4

$svc = Get-Service -Name $ServiceName
if ($svc.Status -ne 'Running') {
    Write-Host "Service status: $($svc.Status)" -ForegroundColor Red
    Write-Host "Check logs: $LogDir\api-err.log" -ForegroundColor Yellow
    throw "Service failed to start."
}

Write-Host "[5/5] Health check"
try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 10
    Write-Host "      HTTP $($r.StatusCode)"
    Write-Host "      $($r.Content)"
} catch {
    Write-Host "Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "The service is running but not answering. Inspect $LogDir\api-err.log" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Service '$ServiceName' is running and set to auto-start."
Write-Host "Restart: Restart-Service $ServiceName"
Write-Host "Logs   : Get-Content $LogDir\api-err.log -Tail 50 -Wait"

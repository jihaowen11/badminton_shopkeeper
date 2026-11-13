#Requires -Version 5.1
<#
.SYNOPSIS
    Daily backup: MySQL dump + avatar folder archive, with retention cleanup.

.DESCRIPTION
    - Dumps the database with mysqldump --result-file (avoids PowerShell's
      UTF-16 redirection problem entirely)
    - Zips public\avatar so uploaded avatars survive a rebuild
    - Removes files older than -KeepDays from the backup folder

.PARAMETER Root
    Deployment root, default C:\apps\badminton

.PARAMETER MysqlBinDir
    Folder containing mysqldump.exe. Auto-detected when omitted.

.PARAMETER DBPassword
    Password for DBUser. Prefer passing it, or set it once in a scheduled task.

.EXAMPLE
    .\backup.ps1 -Root C:\apps\badminton -DBPassword 'your-password'

.EXAMPLE
    schtasks /Create /TN "BadmintonBackup" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\apps\badminton\repo\deploy\windows\backup.ps1 -DBPassword XXXX" /SC DAILY /ST 03:30 /RU SYSTEM /F
#>
[CmdletBinding()]
param(
    [string]$Root = 'C:\apps\badminton',
    [string]$ServerDir = '',
    [string]$MysqlBinDir = '',
    [string]$DBName = 'badminton',
    [string]$DBUser = 'badminton',
    [string]$DBPassword = '',
    [int]$KeepDays = 7
)

$ErrorActionPreference = 'Stop'

function Find-MysqlBin {
    param([string]$Explicit)

    if ($Explicit) {
        $exe = Join-Path $Explicit 'mysqldump.exe'
        if (-not (Test-Path $exe)) { throw "mysqldump.exe not found in $Explicit" }
        return $Explicit
    }

    $candidates = @(
        'C:\Program Files\MySQL\MySQL Server 8.4\bin',
        'C:\Program Files\MySQL\MySQL Server 8.0\bin',
        'C:\Program Files\MySQL\MySQL Server 5.7\bin'
    )
    foreach ($c in $candidates) {
        if (Test-Path (Join-Path $c 'mysqldump.exe')) { return $c }
    }

    $cmd = Get-Command mysqldump -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { return (Split-Path $cmd.Source -Parent) }

    throw "mysqldump.exe not found. Pass -MysqlBinDir explicitly."
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $Root 'backups'
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}

$bin = Find-MysqlBin -Explicit $MysqlBinDir
$dumpExe = Join-Path $bin 'mysqldump.exe'
$sqlFile = Join-Path $BackupDir "db-$stamp.sql"

Write-Host "[1/3] Dumping database '$DBName'"

# MYSQL_PWD keeps the password off the command line (no shell history leak).
# Note: no --databases flag, so the dump excludes CREATE DATABASE / USE.
# That keeps the file restorable by a least-privilege account.
$env:MYSQL_PWD = $DBPassword
& $dumpExe -u $DBUser `
    --default-character-set=utf8mb4 `
    --single-transaction `
    --routines `
    --triggers `
    --set-gtid-purged=OFF `
    --result-file=$sqlFile `
    $DBName

if ($LASTEXITCODE -ne 0) {
    throw "mysqldump failed with exit code $LASTEXITCODE"
}

$size = [math]::Round((Get-Item $sqlFile).Length / 1KB, 1)
Write-Host "      $sqlFile ($size KB)"

Write-Host "[2/3] Archiving avatars"
if (-not $ServerDir) { $ServerDir = Join-Path $Root 'repo\node\server' }
$avatarDir = Join-Path $ServerDir 'public\avatar'
if (Test-Path $avatarDir) {
    $zipFile = Join-Path $BackupDir "avatar-$stamp.zip"
    $items = Get-ChildItem -Path $avatarDir -Force
    if ($items.Count -gt 0) {
        Compress-Archive -Path (Join-Path $avatarDir '*') -DestinationPath $zipFile -Force
        $zsize = [math]::Round((Get-Item $zipFile).Length / 1KB, 1)
        Write-Host "      $zipFile ($zsize KB)"
    } else {
        Write-Host "      avatar folder is empty, skipped"
    }
} else {
    Write-Host "      avatar folder not found, skipped"
}

Write-Host "[3/3] Cleaning backups older than $KeepDays days"
$old = Get-ChildItem -Path $BackupDir -File |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) }
if ($old) {
    $old | ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Host "      removed $($_.Name)"
    }
} else {
    Write-Host "      nothing to remove"
}

Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
Write-Host "Backup finished."

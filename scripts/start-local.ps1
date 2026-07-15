param(
  [switch]$KeepAlive
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $root "api"
$logDir = Join-Path $root ".logs"
$envPath = Join-Path $root ".env"
$startedProcesses = @()

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-Url {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Get-LocalEnvValue {
  param(
    [string]$Key,
    [string]$Fallback
  )

  if (-not (Test-Path $envPath)) {
    return $Fallback
  }

  $line = Get-Content $envPath | Where-Object {
    $_ -match "^\s*$([regex]::Escape($Key))\s*="
  } | Select-Object -First 1

  if (-not $line) {
    return $Fallback
  }

  return (($line -split "=", 2)[1]).Trim().Trim('"')
}

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port
  )

  try {
    $client = [System.Net.Sockets.TcpClient]::new()
    $task = $client.ConnectAsync($HostName, $Port)
    $ok = $task.Wait(1000) -and $client.Connected
    $client.Close()
    return $ok
  } catch {
    return $false
  }
}

function Start-LocalProcess {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string[]]$Arguments,
    [string]$HealthUrl
  )

  if (Test-Url $HealthUrl) {
    Write-Host "$Name sudah berjalan: $HealthUrl"
    return
  }

  $stdout = Join-Path $logDir "$Name.out.log"
  $stderr = Join-Path $logDir "$Name.err.log"

  $process = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList $Arguments `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru
  if ($process) {
    $script:startedProcesses += $process
  }

  Write-Host "Menyalakan $Name..."
}

Start-LocalProcess `
  -Name "api-local" `
  -WorkingDirectory $apiDir `
  -Arguments @("run", "start:local") `
  -HealthUrl "http://127.0.0.1:3001/api/health"

Start-LocalProcess `
  -Name "web-local" `
  -WorkingDirectory $root `
  -Arguments @("run", "dev:web", "--", "--host", "127.0.0.1") `
  -HealthUrl "http://127.0.0.1:5173"

Start-Sleep -Seconds 4

$dbHost = Get-LocalEnvValue -Key "DB_HOST" -Fallback "127.0.0.1"
$dbPort = [int](Get-LocalEnvValue -Key "DB_PORT" -Fallback "5432")
$dbOk = Test-TcpPort -HostName $dbHost -Port $dbPort
$apiOk = Test-Url "http://127.0.0.1:3001/api/health"
$proxyOk = Test-Url "http://127.0.0.1:5173/api/health"
$webOk = Test-Url "http://127.0.0.1:5173"

Write-Host ""
Write-Host "Status lokal:"
Write-Host "  PostgreSQL    : $(if ($dbOk) { 'OK' } else { 'BELUM SIAP' }) ${dbHost}:${dbPort}"
Write-Host "  API langsung  : $(if ($apiOk) { 'OK' } else { 'BELUM SIAP' }) http://127.0.0.1:3001/api/health"
Write-Host "  Proxy Vite    : $(if ($proxyOk) { 'OK' } else { 'BELUM SIAP' }) http://127.0.0.1:5173/api/health"
Write-Host "  Aplikasi      : $(if ($webOk) { 'OK' } else { 'BELUM SIAP' }) http://127.0.0.1:5173"
Write-Host ""
Write-Host "Log tersimpan di: $logDir"

if (-not $dbOk) {
  Write-Host "Nyalakan PostgreSQL lokal dulu, lalu jalankan ulang npm run dev:local."
}

if (-not ($dbOk -and $apiOk -and $proxyOk -and $webOk)) {
  Write-Host "Kalau ada yang BELUM SIAP, buka log .logs/api-local.err.log atau .logs/web-local.err.log."
  exit 1
}

if ($KeepAlive) {
  Write-Host ""
  Write-Host "Mode testing aktif. Biarkan terminal ini terbuka selama testing."
  Write-Host "Tekan Ctrl+C kalau sudah selesai."

  while ($true) {
    Start-Sleep -Seconds 30
  }
}

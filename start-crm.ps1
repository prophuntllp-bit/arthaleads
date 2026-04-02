$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

function Test-Http {
  param([string]$Url)
  try {
    Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Ensure-Running {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$Command,
    [string]$HealthUrl
  )

  if (Test-Http $HealthUrl) {
    Write-Host "$Name is already running at $HealthUrl" -ForegroundColor Green
    return
  }

  Write-Host "Starting $Name..." -ForegroundColor Yellow
  Start-Process powershell -WorkingDirectory $WorkingDirectory -ArgumentList "-NoExit", "-Command", $Command | Out-Null

  $started = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Http $HealthUrl) {
      $started = $true
      break
    }
  }

  if (-not $started) {
    throw "$Name did not become ready at $HealthUrl"
  }

  Write-Host "$Name started successfully at $HealthUrl" -ForegroundColor Green
}

Ensure-Running -Name "Backend" -WorkingDirectory $backendDir -Command "npm start" -HealthUrl "http://localhost:5000/health"
Ensure-Running -Name "Frontend" -WorkingDirectory $frontendDir -Command "npm run dev" -HealthUrl "http://localhost:3000"

Write-Host ""
Write-Host "PropCRM is ready:" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000"
Write-Host "Backend : http://localhost:5000/health"

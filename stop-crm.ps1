$ErrorActionPreference = "SilentlyContinue"

$ports = @(3000, 5000)

foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen
  foreach ($connection in $connections) {
    Stop-Process -Id $connection.OwningProcess -Force
    Write-Host "Stopped process $($connection.OwningProcess) on port $port" -ForegroundColor Yellow
  }
}

Write-Host "PropCRM local servers stopped." -ForegroundColor Green

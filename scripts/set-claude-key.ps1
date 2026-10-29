# Paste the Claude (Anthropic) API key once. It is never shown on screen.
# 1. Tests it with one tiny request to Claude Haiku 5.5 (prints only the status code).
# 2. If it works: saves it to backend/.env on this computer and to Railway as
#    ANTHROPIC_API_KEY (staging redeploys now; production gets it without a
#    redeploy, so it is used from the next live release).
$ErrorActionPreference = "Stop"
$secure = Read-Host "Paste the Claude API key (hidden), then press Enter" -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
if (-not $key.StartsWith("sk-ant-")) { Write-Host "That doesn't look like a Claude key (it should start with sk-ant-). Nothing saved."; exit 1 }

$body = '{"model":"claude-haiku-5-5","max_tokens":16,"messages":[{"role":"user","content":"Say ok"}]}'
$headers = @{ "x-api-key" = $key; "anthropic-version" = "2023-06-01"; "content-type" = "application/json" }
try {
  $r = Invoke-WebRequest -Uri "https://api.anthropic.com/v1/messages" -Method Post -Headers $headers -Body $body -UseBasicParsing
  $status = [int]$r.StatusCode
} catch {
  $status = [int]$_.Exception.Response.StatusCode
  $detail = ""
  try { $detail = (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } catch {}
  Write-Host "Claude answered $status. Nothing saved."
  if ($detail) { Write-Host ($detail -replace 'sk-ant-[A-Za-z0-9_\-]+', '[key]') }
  exit 1
}
Write-Host "Claude answered $status (OK)."

$envPath = "E:\PROPHUNT CRM\backend\.env"
$lines = Get-Content $envPath | Where-Object { $_ -notmatch '^ANTHROPIC_API_KEY=' }
$lines += "ANTHROPIC_API_KEY=$key"
[IO.File]::WriteAllLines($envPath, [string[]]$lines, (New-Object Text.UTF8Encoding($false)))  # no BOM, or dotenv misreads line 1
Write-Host "Saved to backend/.env on this computer."

Set-Location "E:\PROPHUNT CRM-staging"
$key | railway variable set ANTHROPIC_API_KEY --stdin -s arthaleads-staging -e staging | Out-Null
Write-Host "Saved on Railway staging (it redeploys)."
$key | railway variable set ANTHROPIC_API_KEY --stdin -s Arthaleads -e production --skip-deploys | Out-Null
Write-Host "Saved on Railway production (no redeploy; used from the next live release)."
$key = $null
Write-Host "Done. You can close this tab."

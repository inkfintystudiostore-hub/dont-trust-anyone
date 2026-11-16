# Usage: tools/take-gemini-download.ps1 <name>
# Moves the newest finished Gemini_Generated_Image_*.png from Downloads to assets/refs/<name>.png
param([Parameter(Mandatory)][ValidatePattern('^[a-z0-9_]+$')][string]$Name)
$src = Get-ChildItem "$env:USERPROFILE\Downloads" -Filter 'Gemini_Generated_Image_*.png' |
  Where-Object { $_.Length -gt 100KB -and $_.LastWriteTime -gt (Get-Date).AddMinutes(-5) } |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $src) { throw "No finished Gemini download from the last 5 minutes" }
# the browser may still be writing: wait until the size stops changing
do { $size = $src.Length; Start-Sleep -Milliseconds 800; $src.Refresh() } while ($src.Length -ne $size)
$dest = Join-Path $PSScriptRoot "..\assets\refs\$Name.png"
Move-Item $src.FullName $dest -Force
"$Name.png <- $($src.Name) ($([math]::Round($src.Length/1MB,1)) MB)"

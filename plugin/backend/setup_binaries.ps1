# PowerShell helper to download ffmpeg & whisper binaries (Windows)
# EDIT these URLs to the versions you want. Use at your own risk.

$dest = Join-Path $PSScriptRoot 'bin'
if (!(Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }

Write-Host "Downloading ffmpeg..."
$ffUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
$ffZip = Join-Path $env:TEMP 'ffmpeg.zip'
Invoke-WebRequest -Uri $ffUrl -OutFile $ffZip
Write-Host "Extracting ffmpeg..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($ffZip, $env:TEMP)
# Note: adjust the path below based on the extracted folder structure
Copy-Item -Path (Join-Path $env:TEMP 'ffmpeg-*-essentials_build*/bin/ffmpeg.exe') -Destination $dest -Force -ErrorAction SilentlyContinue

Write-Host "Done. Please verify ffmpeg.exe is in plugin/backend/bin/"

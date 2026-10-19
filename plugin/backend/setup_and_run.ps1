<#
  setup_and_run.ps1
  - Tự động: download ffmpeg, clone whisper.cpp (nếu git), try to build, download model (try), convert video -> wav, run whisper, run silencedetect.
  - Usage:
      .\setup_and_run.ps1 -InputVideo "C:\path\to\video.mp4"
#>

param(
  [string]$InputVideo = ".\test_assets\sample.mp4",
  [string]$FFmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
  [string[]]$ModelCandidates = @(
    "https://ggml.ggerganov.com/models/ggml-base.en.bin",
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/models/ggml-base.en.bin"
  ),
  [string]$BackendDir = (Split-Path -Parent $MyInvocation.MyCommand.Definition)
)

set -e

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

# Ensure directories
$newDirs = @("bin","models","test_assets","output")
foreach ($d in $newDirs) {
  $p = Join-Path $BackendDir $d
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null }
}

# Helper to download a file
function Download-File($url, $dest) {
  Write-Info "Downloading $url ..."
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -ErrorAction Stop
    Write-Info "Saved to $dest"
    return $true
  } catch {
    Write-Warn "Failed to download $url : $($_.Exception.Message)"
    return $false
  }
}

# 1) Download & extract ffmpeg
$ffZip = Join-Path $BackendDir "ffmpeg.zip"
$ffTempExtract = Join-Path $env:TEMP "ffmpeg_extract_$(Get-Random)"

if (-not (Test-Path (Join-Path $BackendDir "bin\ffmpeg.exe"))) {
  Write-Info "Downloading FFmpeg from $FFmpegUrl ..."
  if (Download-File $FFmpegUrl $ffZip) {
    Write-Info "Extracting FFmpeg..."
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path $ffTempExtract) { Remove-Item -Recurse -Force $ffTempExtract }
    New-Item -ItemType Directory -Path $ffTempExtract | Out-Null
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ffZip, $ffTempExtract)
    # Search for ffmpeg.exe inside extracted folders
    $found = Get-ChildItem -Path $ffTempExtract -Filter "ffmpeg.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
      Copy-Item $found.FullName -Destination (Join-Path $BackendDir "bin\ffmpeg.exe") -Force
      # try locate ffprobe.exe too
      $foundProbe = Get-ChildItem -Path $ffTempExtract -Filter "ffprobe.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($foundProbe) { Copy-Item $foundProbe.FullName -Destination (Join-Path $BackendDir "bin\ffprobe.exe") -Force }
      Write-Info "ffmpeg and ffprobe copied to plugin/backend/bin/"
    } else {
      Write-Warn "Couldn't find ffmpeg.exe inside the downloaded zip. Please download manually and place ffmpeg.exe/ffprobe.exe into plugin/backend/bin/"
    }
    Remove-Item $ffZip -Force -ErrorAction SilentlyContinue
    Remove-Item $ffTempExtract -Recurse -Force -ErrorAction SilentlyContinue
  } else {
    Write-Warn "FFmpeg download failed; please download and place ffmpeg.exe into plugin/backend/bin/"
  }
} else {
  Write-Info "ffmpeg already present in plugin/backend/bin/"
}

# 2) Clone whisper.cpp if git available
$whisperDir = Join-Path $BackendDir "whisper.cpp"
if (-not (Test-Path $whisperDir)) {
  $git = (Get-Command git -ErrorAction SilentlyContinue)
  if ($git) {
    Write-Info "Cloning whisper.cpp ..."
    git clone https://github.com/ggerganov/whisper.cpp $whisperDir
  } else {
    Write-Warn "Git not found. To build whisper.cpp you need Git + Visual Studio Build Tools. Install Git and re-run this script (or clone repo manually into plugin/backend/whisper.cpp)."
  }
} else {
  Write-Info "whisper.cpp already cloned"
}

# 3) Try to build whisper.cpp (Windows)
$builtExe = $null
if (Test-Path $whisperDir) {
  # prefer scripts/build.cmd if exists
  $buildCmd = Join-Path $whisperDir "scripts\build.cmd"
  $buildPs  = Join-Path $whisperDir "scripts\build.ps1"
  if (Test-Path $buildCmd) {
    Write-Info "Attempting to build whisper.cpp using scripts\\build.cmd (requires Visual Studio Build Tools)..."
    try {
      Push-Location $whisperDir
      & cmd.exe /c scripts\build.cmd
      Pop-Location
    } catch {
      Write-Warn "Build failed or build tools missing. See whisper.cpp docs to install MSVC/CMake. You can also use a prebuilt binary if available."
      Pop-Location -ErrorAction SilentlyContinue
    }
  } elseif (Test-Path $buildPs) {
    Write-Info "Attempting to build whisper.cpp using scripts\\build.ps1..."
    try {
      Push-Location $whisperDir
      & powershell -ExecutionPolicy Bypass -File scripts\build.ps1
      Pop-Location
    } catch {
      Write-Warn "Build failed or build tools missing. See whisper.cpp docs."
      Pop-Location -ErrorAction SilentlyContinue
    }
  } else {
    Write-Warn "No build script found in whisper.cpp/scripts. Check the repo or build manually."
  }

  # Try to find built exe (main.exe)
  $foundExe = Get-ChildItem -Path $whisperDir -Filter "main.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($foundExe) {
    $builtExe = $foundExe.FullName
    Write-Info "Found whisper executable: $builtExe"
    # copy to bin for convenience
    Copy-Item $builtExe -Destination (Join-Path $BackendDir "bin\whisper.exe") -Force
    Write-Info "Copied whisper.exe to plugin/backend/bin/"
  } else {
    Write-Warn "Could not find built whisper executable. If you already have a prebuilt binary, place it at plugin/backend/bin/whisper.exe"
  }
}

# Also check if user already placed whisper.exe in bin
$whisperBin = Join-Path $BackendDir "bin\whisper.exe"
if (Test-Path $whisperBin) {
  Write-Info "Using existing whisper binary: $whisperBin"
  $builtExe = $whisperBin
}

# 4) Download model (try candidate URLs)
$modelDir = Join-Path $BackendDir "models"
if (-not (Test-Path $modelDir)) { New-Item -ItemType Directory -Path $modelDir | Out-Null }
$modelFile = Join-Path $modelDir "ggml-base.en.bin"
if (-not (Test-Path $modelFile)) {
  $success = $false
  foreach ($url in $ModelCandidates) {
    Write-Info "Trying to download model from $url ..."
    if (Download-File $url $modelFile) { $success = $true; break }
  }
  if (-not $success) {
    Write-Warn "Model download failed from candidate URLs. Please manually download a ggml model (e.g. ggml-base.en.bin) and place it into plugin/backend/models/ then re-run this script."
  } else {
    Write-Info "Model saved to $modelFile"
  }
} else {
  Write-Info "Model already present: $modelFile"
}

# Helper: resolve ffmpeg path
$ffmpegExe = Join-Path $BackendDir "bin\ffmpeg.exe"
if (-not (Test-Path $ffmpegExe)) {
  $ffmpegExe = "ffmpeg"  # assume in PATH
}
$ffprobeExe = Join-Path $BackendDir "bin\ffprobe.exe"
if (-not (Test-Path $ffprobeExe)) {
  $ffprobeExe = "ffprobe"
}

# 5) Prepare input - ensure InputVideo exists
$absInput = Resolve-Path -LiteralPath $InputVideo -ErrorAction SilentlyContinue
if (-not $absInput) {
  Write-Err "Input video not found: $InputVideo`nPlace your file at plugin/backend/test_assets/sample.mp4 or pass -InputVideo path."
  exit 1
}
$absInput = $absInput.Path
Write-Info "Input video: $absInput"

# 6) Extract audio to WAV (16kHz mono)
$outWav = Join-Path $BackendDir "output\extracted.wav"
Write-Info "Extracting audio to WAV: $outWav ..."
$ffArgs = @("-y","-i",$absInput,"-ar","16000","-ac","1","-c:a","pcm_s16le",$outWav)
$proc = Start-Process -FilePath $ffmpegExe -ArgumentList $ffArgs -NoNewWindow -PassThru -Wait
if ($proc.ExitCode -ne 0) {
  Write-Warn "ffmpeg returned exit code $($proc.ExitCode). Ensure ffmpeg.exe is valid. You can try running: $ffmpegExe -version"
}

# 7) Run silence detection using ffmpeg and gather cutlist (we will also save the raw ffmpeg stderr)
Write-Info "Running silence detection (ffmpeg silencedetect) ..."
$silenceLog = Join-Path $BackendDir "output\silence_ffmpeg.log"
$ffArgs2 = @("-y","-i",$absInput,"-af","silencedetect=n=-35dB:d=0.5","-f","null","-")
# Run and capture stderr
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $ffmpegExe
$psi.Arguments = $ffArgs2 -join ' '
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$proc2 = [System.Diagnostics.Process]::Start($psi)
$stderrText = $proc2.StandardError.ReadToEnd()
$proc2.WaitForExit()
$stderrText | Out-File -FilePath $silenceLog -Encoding utf8
Write-Info "Silence detection log saved to $silenceLog"

# Try to parse silences into segments (simple heuristic)
function Parse-SilenceToSegments($stderr, $duration) {
  $lines = $stderr -split "`r?`n"
  $events = @()
  foreach ($l in $lines) {
    if ($l -match "silence_start: ([0-9.]+)") { $events += @{type='start'; t=[double]$matches[1]} }
    if ($l -match "silence_end: ([0-9.]+) \| silence_duration: ([0-9.]+)") { $events += @{type='end'; t=[double]$matches[1]; dur=[double]$matches[2]} }
  }
  $silenceIntervals = @()
  for ($i=0;$i -lt $events.Count; $i++) {
    if ($events[$i].type -eq 'start') {
      # find next end
      $end = $events | Where-Object { $_.type -eq 'end' -and $_.t -ge $events[$i].t } | Select-Object -First 1
      if ($end) { $silenceIntervals += ,@($events[$i].t, $end.t) } else { $silenceIntervals += ,@($events[$i].t, $duration) }
    }
  }
  $segments = @()
  $cursor = 0.0
  foreach ($si in $silenceIntervals) {
    $s = [double]$si[0]; $e = [double]$si[1]
    if ($cursor -lt $s) { $segments += @{start = [math]::Round($cursor,3); end = [math]::Round($s,3)} }
    $cursor = $e
  }
  if ($duration -gt 0 -and $cursor -lt $duration) { $segments += @{start = [math]::Round($cursor,3); end = [math]::Round($duration,3)} }
  return $segments
}

# get duration via ffprobe if available
$duration = 0.0
try {
  $probeProc = Start-Process -FilePath $ffprobeExe -ArgumentList "-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",$absInput -NoNewWindow -RedirectStandardOutput "pipe" -PassThru
  $out = $probeProc.StandardOutput.ReadToEnd()
  $probeProc.WaitForExit()
  $duration = [double]($out.Trim()) -as [double]
  if (-not $duration) { $duration = 0.0 }
} catch {
  Write-Warn "ffprobe not available or failed to get duration. Duration default to 0."
}
Write-Info "Detected duration: $duration seconds"

$segments = Parse-SilenceToSegments $stderrText $duration
$outCutlist = Join-Path $BackendDir "output\cutlist.json"
$segments | ConvertTo-Json -Depth 4 | Out-File -FilePath $outCutlist -Encoding utf8
Write-Info "Cutlist saved to $outCutlist (non-silent segments)"

# 8) Run whisper offline (if binary + model present)
if ((Test-Path $builtExe) -or (Test-Path $whisperBin)) {
  $exeToRun = if (Test-Path $whisperBin) { $whisperBin } else { $builtExe }
  if (-not (Test-Path $modelFile)) {
    Write-Warn "Model not found at $modelFile; skipping whisper. Place model at plugin/backend/models/ and re-run."
  } else {
    Write-Info "Running whisper offline: $exeToRun -m $modelFile -f $outWav ..."
    $outTranscriptTxt = Join-Path $BackendDir "output\transcript.txt"
    $outTranscriptSrt = Join-Path $BackendDir "output\transcript.srt"
    # try to run with both txt and srt outputs (if whisper supports -otxt / -osrt flags)
    $args = @("-m", $modelFile, "-f", $outWav, "-otxt")
    # If whisper supports -osrt, include; otherwise only txt
    $procW = Start-Process -FilePath $exeToRun -ArgumentList $args -NoNewWindow -RedirectStandardOutput "pipe" -RedirectStandardError "pipe" -PassThru
    $stdOut = $procW.StandardOutput.ReadToEnd()
    $stdErr = $procW.StandardError.ReadToEnd()
    $procW.WaitForExit()
    $stdOut | Out-File -FilePath $outTranscriptTxt -Encoding utf8
    Write-Info "Transcript (text) saved to $outTranscriptTxt"
    # attempt SRT extraction: many builds support -osrt or --srt; we try a second run if supported
    if ($stdErr -match "Usage" -or $stdOut -match "SRT") {
      # ambiguous; we also try calling with -osrt if supported
      try {
        $args2 = @("-m", $modelFile, "-f", $outWav, "-osrt")
        $procW2 = Start-Process -FilePath $exeToRun -ArgumentList $args2 -NoNewWindow -RedirectStandardOutput "pipe" -RedirectStandardError "pipe" -PassThru
        $sout2 = $procW2.StandardOutput.ReadToEnd(); $serr2 = $procW2.StandardError.ReadToEnd()
        $procW2.WaitForExit()
        if ($sout2) { $sout2 | Out-File -FilePath $outTranscriptSrt -Encoding utf8; Write-Info "Transcript (srt) saved to $outTranscriptSrt" }
      } catch { Write-Warn "Second attempt for SRT failed or not supported: $($_.Exception.Message)" }
    }
  }
} else {
  Write-Warn "Whisper binary not found; skipping transcription. Place whisper.exe or build whisper.cpp and put binary into plugin/backend/bin/whisper.exe"
}

Write-Info "Done. Results are in: $(Join-Path $BackendDir 'output')"
Write-Info "Files: (cutlist.json, silence log, extracted.wav, transcript.txt, transcript.srt if created)."
Write-Info "If you want me to commit these files into the repo, upload them to the repo or grant me permission to push (we already have push on HyperFrame)."

# End

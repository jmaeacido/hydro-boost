# Compresses hero and section background videos for web delivery.
# Requires ffmpeg on PATH (winget install Gyan.FFmpeg).

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Compress-Video {
  param(
    [string]$InputPath,
    [string]$OutputPath,
    [int]$MaxHeight = 1080,
    [int]$Crf = 28
  )

  if (-not (Test-Path $InputPath)) {
    Write-Warning "Skip missing: $InputPath"
    return
  }

  $outDir = Split-Path -Parent $OutputPath
  if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
  }

  Write-Host "Encoding $InputPath -> $OutputPath"
  & ffmpeg -y -hide_banner -loglevel error -i $InputPath `
    -an -c:v libx264 -preset slow -crf $Crf `
    -vf "scale=-2:$MaxHeight" -movflags +faststart `
    $OutputPath
}

$jobs = @(
  @{ In = "assets/Hero video.mp4"; Out = "assets/Hero video.web.mp4"; H = 1080; Crf = 27 },
  @{ In = "assets/videos/weights.mp4"; Out = "assets/videos/weights.web.mp4"; H = 720; Crf = 28 },
  @{ In = "assets/videos/push-ups.mp4"; Out = "assets/videos/push-ups.web.mp4"; H = 720; Crf = 28 },
  @{ In = "assets/videos/cycling.mp4"; Out = "assets/videos/cycling.web.mp4"; H = 720; Crf = 28 },
  @{ In = "assets/videos/basketball.mp4"; Out = "assets/videos/basketball.web.mp4"; H = 720; Crf = 28 },
  @{ In = "assets/videos/road-bike.mp4"; Out = "assets/videos/road-bike.web.mp4"; H = 720; Crf = 28 },
  @{ In = "assets/videos/hiking.mp4"; Out = "assets/videos/hiking.web.mp4"; H = 720; Crf = 28 }
)

Push-Location $root
try {
  foreach ($job in $jobs) {
    Compress-Video -InputPath $job.In -OutputPath $job.Out -MaxHeight $job.H -Crf $job.Crf
  }

  if (Test-Path "assets/ad-reference.png") {
    Write-Host "Encoding assets/ad-reference.webp"
    & ffmpeg -y -hide_banner -loglevel error -i "assets/ad-reference.png" -c:v libwebp -quality 82 "assets/ad-reference.webp"
  }
}
finally {
  Pop-Location
}

Write-Host "Done."

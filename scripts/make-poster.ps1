Add-Type -AssemblyName System.Drawing
$src = Join-Path $PSScriptRoot "..\assets\ad-reference.png"
$dst = Join-Path $PSScriptRoot "..\assets\ad-reference-poster.jpg"
$img = [System.Drawing.Image]::FromFile($src)
$maxW = 1920
if ($img.Width -gt $maxW) {
  $ratio = $maxW / $img.Width
  $nw = [int]$maxW
  $nh = [int]($img.Height * $ratio)
  $bmp = New-Object System.Drawing.Bitmap $nw, $nh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $nw, $nh)
  $g.Dispose()
  $img.Dispose()
  $img = $bmp
}
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 82
$img.Save($dst, $enc, $ep)
$img.Dispose()
Write-Output ((Get-Item $dst).Length)

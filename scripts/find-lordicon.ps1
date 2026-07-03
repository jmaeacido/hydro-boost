$pages = @(
  "503-run",
  "429-weight-gym-fitness",
  "1801-basket-ball",
  "661-trekking-hiking-mountain",
  "1813-curls-with-dumbbells",
  "479-laptop-notebook",
  "143-paperplane-send",
  "478-computer-display",
  "458-goal-target",
  "36-bulb"
)

foreach ($p in $pages) {
  $url = "https://lordicon.com/icons/wired/flat/$p"
  try {
    $html = (Invoke-WebRequest -Uri $url -UseBasicParsing -Headers @{"User-Agent"="Mozilla/5.0"}).Content
    $matches = [regex]::Matches($html, 'cdn\.lordicon\.com/[a-z0-9]+\.json')
    if ($matches.Count -gt 0) {
      Write-Output "$p -> $($matches[0].Value)"
      continue
    }
    $matches2 = [regex]::Matches($html, '"json":"([^"]+)"')
    if ($matches2.Count -gt 0) {
      Write-Output "$p -> $($matches2[0].Groups[1].Value)"
      continue
    }
    $matches3 = [regex]::Matches($html, 'index&quot;:(\d+)')
    Write-Output "$p -> no json (index matches: $($matches3.Count))"
  } catch {
    Write-Output "$p -> error: $($_.Exception.Message)"
  }
}

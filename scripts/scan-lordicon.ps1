$icons = @(
  "429-weight-gym-fitness",
  "503-run",
  "1801-basket-ball",
  "661-trekking-hiking-mountain",
  "1813-curls-with-dumbbells",
  "479-laptop-notebook",
  "143-paperplane-send",
  "478-computer-display",
  "458-goal-target",
  "36-bulb",
  "503-bicycle",
  "504-bicycle",
  "500-bicycle",
  "501-bicycle",
  "502-bicycle",
  "504-bicycle-ride",
  "505-bicycle",
  "506-bicycle",
  "507-bicycle",
  "508-bicycle",
  "509-bicycle",
  "510-bicycle",
  "511-bicycle",
  "512-bicycle",
  "513-bicycle",
  "514-bicycle",
  "515-bicycle",
  "516-bicycle",
  "517-bicycle",
  "518-bicycle",
  "519-bicycle",
  "520-bicycle",
  "521-bicycle",
  "522-bicycle",
  "523-bicycle",
  "524-bicycle",
  "525-bicycle",
  "526-bicycle",
  "527-bicycle",
  "528-bicycle",
  "529-bicycle",
  "530-bicycle",
  "531-bicycle",
  "532-bicycle",
  "533-bicycle",
  "534-bicycle",
  "535-bicycle",
  "536-bicycle",
  "537-bicycle",
  "538-bicycle",
  "539-bicycle",
  "540-bicycle",
  "541-bicycle",
  "542-bicycle",
  "543-bicycle",
  "544-bicycle",
  "545-bicycle",
  "546-bicycle",
  "547-bicycle",
  "548-bicycle",
  "549-bicycle",
  "550-bicycle"
)

foreach ($icon in $icons) {
  $url = "https://lordicon.com/icons/wired/flat/$icon"
  try {
    $html = (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 8).Content
    if ($html -match 'data-src="([^"]+)"[^>]*data-title="([^"]+)"[^>]*data-premium="(true|false)"') {
      Write-Output "$icon | $($Matches[2]) | premium=$($Matches[3]) | $($Matches[1])"
    } elseif ($html -match 'data-premium="(true|false)"') {
      Write-Output "$icon | found premium=$($Matches[1])"
    }
  } catch {}
}

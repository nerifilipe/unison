param([string]$BaseUrl = 'http://localhost:3000')
$ErrorActionPreference = 'Stop'
$tracks = Invoke-RestMethod "$BaseUrl/api/tracks"
if ($tracks.Count -ne 3) { throw "Expected 3 demo tracks; got $($tracks.Count)" }
foreach ($track in $tracks) {
    $response = Invoke-WebRequest "$BaseUrl$($track.audioUrl)" -Headers @{ Range = 'bytes=0-43' }
    if ([int]$response.StatusCode -ne 206) { throw "Range request failed for $($track.id)" }
    Write-Output "OK: $($track.title), HTTP 206, $($response.Headers['Content-Type'])"
}
Write-Output 'API and storage smoke check passed. Run frontend Playwright tests to verify playback.'

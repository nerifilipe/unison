param([string]$BaseUrl = 'http://localhost:3000')
$ErrorActionPreference = 'Stop'
$null = Invoke-WebRequest "$BaseUrl/" -UseBasicParsing -TimeoutSec 20
$catalog = Invoke-RestMethod "$BaseUrl/api/tracks" -TimeoutSec 20
$tracks = @($catalog | Where-Object { $_.id -in @('first-light','slow-orbit','tidal') })
if ($tracks.Count -ne 3) { throw "Expected 3 demo tracks; got $($tracks.Count)" }
foreach ($track in $tracks) {
    # Windows PowerShell 5.1 rejects Range in Invoke-WebRequest's Headers argument.
    $request = [System.Net.HttpWebRequest]::Create("$BaseUrl$($track.audioUrl)")
    $request.Timeout = 20000
    $request.AddRange(0, 43)
    $response = $request.GetResponse()
    try {
        if ([int]$response.StatusCode -ne 206) { throw "Range request failed for $($track.id)" }
        Write-Output "OK: $($track.title), HTTP 206, $($response.ContentType)"
    } finally {
        $response.Close()
    }
}
Write-Output 'API and storage smoke check passed. Run frontend Playwright tests to verify playback.'

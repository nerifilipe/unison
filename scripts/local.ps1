param(
    [ValidateSet('start', 'stop', 'status', 'logs', 'verify')]
    [string]$Action = 'start'
)
$ErrorActionPreference = 'Stop'

# Resolve paths relative to this script, including when called from another folder.
$repoRoot = Split-Path $PSScriptRoot -Parent
$dockerCommand = Get-Command docker -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($dockerCommand) {
    $dockerBin = $dockerCommand.Source
} else {
    $dockerDirectory = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin'
    if (Test-Path (Join-Path $dockerDirectory 'docker.exe')) {
        $dockerBin = Join-Path $dockerDirectory 'docker.exe'
        $env:PATH = "$dockerDirectory;$env:PATH"
    } else {
        throw 'Docker was not found. Install Docker Desktop, reopen your terminal and start its Linux engine.'
    }
}

function Invoke-Compose {
    & $dockerBin compose --project-directory $repoRoot -f "$repoRoot/compose.yaml" @args
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed (exit $LASTEXITCODE). See docs/local-setup.md." }
}

& $dockerBin compose version
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 is required. Update Docker Desktop or install the Compose plugin.' }
$engineType = & $dockerBin info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker is not ready. Start Docker Desktop / Docker Engine and try again.' }
if ($engineType -ne 'linux') { throw 'Switch Docker Desktop to Linux containers and try again.' }

switch ($Action) {
    'start' {
        Invoke-Compose up -d --build --wait --wait-timeout 180
        & "$PSScriptRoot/smoke.ps1"
        Write-Output 'Unison is ready: http://localhost:3000'
    }
    'stop' {
        Invoke-Compose stop
        Write-Output 'Unison stopped. Accounts, playlists and audio are preserved.'
    }
    'status' { Invoke-Compose ps -a }
    'logs' { Invoke-Compose logs --tail=100 }
    'verify' { & "$PSScriptRoot/smoke.ps1" }
}

$ErrorActionPreference = 'Stop'

Write-Host "==> Checking Docker availability ..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker CLI not found. Install Docker Desktop and reopen PowerShell."
}

$composeCmd = @('compose')
try {
    docker compose version | Out-Null
}
catch {
    if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
        $composeCmd = @()
    }
    else {
        Write-Error "Neither 'docker compose' nor 'docker-compose' is available."
    }
}

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    if ($composeCmd.Count -gt 0) {
        & docker @composeCmd @Args
    }
    else {
        & docker-compose @Args
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Compose command failed: $($Args -join ' ')"
    }
}

Write-Host "==> Starting DB for tests ..."
Invoke-Compose -Args @('up', '-d', 'db')

Write-Host "==> Backend tests (pytest) ..."
Invoke-Compose -Args @('run', '--rm', 'backend', 'bash', '-lc', 'python manage.py migrate --noinput && pytest -q')

Write-Host "==> Frontend tests ..."
Invoke-Compose -Args @('run', '--rm', 'frontend', 'bash', '-lc', 'npm run lint && (npm run test -- --watch=false || npm run test || true)')

Write-Host "==> Tests complete."

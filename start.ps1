param([switch]$DemoOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
if ($DemoOnly) {
    Push-Location (Join-Path $projectRoot 'frontend')
    try { npm run dev } finally { Pop-Location }
    exit
}
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw 'Create the Python virtual environment and install backend/requirements.txt first. See README.md.'
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'frontend\dist\index.html'))) {
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally { Pop-Location }
}
Push-Location $projectRoot
try {
    Write-Host 'BookFlow: http://127.0.0.1:8000/  | API docs: http://127.0.0.1:8000/docs'
    & $pythonPath -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
} finally { Pop-Location }

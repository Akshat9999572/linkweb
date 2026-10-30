$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:NODE_OPTIONS = '--dns-result-order=ipv4first'
if (!(Test-Path 'node_modules/next/package.json')) {
    $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
    corepack yarn workspaces focus '@linkwarden/web' '@linkwarden/worker'
    if ($LASTEXITCODE -ne 0) { throw 'Linkwarden dependency installation failed.' }
}
if (!(Test-Path 'local-runtime/node_modules/embedded-postgres/package.json')) {
    Push-Location local-runtime
    npm install --workspaces=false
    Pop-Location
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL runtime installation failed.' }
}
node local-runtime/start.mjs

# Windows counterpart to the POSIX `npm stop` script. Reads $env:PORT and kills
# whichever process owns that TCP port — symmetric with `lsof -ti tcp:$PORT | xargs kill`.
#
# Refuses to run if $env:PORT is empty, missing, or non-numeric so a misconfigured
# env var can't trigger a guess that might kill an unrelated process (the same
# class of footgun that previously took down the Dirigible JVM on POSIX).

$ErrorActionPreference = 'Stop'

if (-not $env:PORT) {
    Write-Error 'ERROR: PORT env var is empty; refusing to stop to avoid killing an unrelated process.'
    exit 1
}

$port = 0
if (-not [int]::TryParse($env:PORT, [ref]$port)) {
    Write-Error ('ERROR: PORT env var is not a valid integer (saw [' + $env:PORT + ']); refusing to stop.')
    exit 1
}

# -ErrorAction SilentlyContinue: a port with no listener is a no-op, matching
# the POSIX `2>/dev/null || true` semantics.
$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if (-not $connections) {
    exit 0
}

foreach ($conn in $connections) {
    try {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
    } catch {
        # Best-effort. The process may have already exited between the lookup
        # and the kill; swallow that to mirror the POSIX `|| true` tail.
    }
}

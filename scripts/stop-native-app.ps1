# Stops the Node server Dirigible spawned for this native app.
#
# Targets ONLY the held PID Dirigible exports as DIRIGIBLE_NATIVE_APP_PID — never
# enumerate PIDs by port (e.g. Get-NetTCPConnection / netstat), because the
# Dirigible JVM keeps idle HttpClient keep-alive connections to the upstream port
# via Spring Cloud Gateway, so a port-based kill would also bring the platform
# down.
#
# `taskkill` without `/F` sends WM_CLOSE, which Node interprets as SIGBREAK and
# uses to fire the same graceful-shutdown path as SIGTERM on POSIX. `/T` also
# terminates child processes so nothing is orphaned.
#
# This is best-effort: the Dirigible platform always follows up with its own
# Process.destroy() (and destroyForcibly() after a grace period) regardless of
# what this script does.

$ErrorActionPreference = 'Stop'
$targetPid = $env:DIRIGIBLE_NATIVE_APP_PID
if ([string]::IsNullOrWhiteSpace($targetPid)) {
    Write-Error "DIRIGIBLE_NATIVE_APP_PID is not set; refusing to stop (this script must be invoked from a Dirigible-spawned stop subprocess)."
    exit 1
}

& taskkill /PID $targetPid /T 2>$null | Out-Null
exit 0

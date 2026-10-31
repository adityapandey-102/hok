<#
  HOK — one-command local dev launcher (adapted from needleye-pilot's).

  Starts the whole local stack:
    1. Supabase (Postgres DB + Auth + Storage, via Docker)
    2. Applies database migrations
    3. (optional) seeds demo data          -->  .\start-dev.ps1 -Seed
    4. Backend API dev server  (hok-api,  http://localhost:4100)  -- new window
    5. Frontend dev server     (hok-web,  http://localhost:3400)  -- new window

  Ports are offset from needleye (Supabase 544xx, API 4100, web 3400) so both
  projects can run on this machine at the same time.

  Usage (from the HOK folder):
    .\start-dev.ps1
    .\start-dev.ps1 -Seed          # also (re)seed demo data
    .\start-dev.ps1 -Reset         # reset the DB (wipes local data) before starting
    .\start-dev.ps1 -Reset -Seed
    .\start-dev.ps1 -NoIpSync      # do NOT auto-update the env LAN IP
    .\start-dev.ps1 -NoUpdateCheck # do NOT check for a newer Supabase CLI

  The Supabase CLI version is PINNED (see $SupabaseCli below) so Docker never
  re-downloads the multi-GB image set behind your back. On start, the script
  checks whether a newer CLI exists and OFFERS it -- answer "n" (the default)
  and nothing changes. Answer "y" and it trials the new version, runs the unit
  + integration suites against it, and only writes the new pin into this file
  if they pass. Failing tests leave the pin untouched, so the next plain run is
  back on the known-good version.

  On start it keeps the env files' LAN IP pointed at this machine's current
  Wi-Fi/Ethernet address (DHCP can change it), swapping ONLY the IP -- ports,
  paths, and which URLs are used are untouched, so CORS / portal links / API base stay
  consistent. Use -NoIpSync to leave the env files alone.

  If PowerShell blocks the script, run:
    powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
#>

param(
  [switch]$Seed,
  [switch]$Reset,
  [switch]$NoIpSync,
  [switch]$NoUpdateCheck
)

$ErrorActionPreference = "Stop"

# Supabase CLI version -- PINNED ON PURPOSE.
#
# A bare `npx supabase` resolves the CLI from the registry on every run, so the
# day Supabase publishes a new CLI you silently get it. Each CLI release pins its
# OWN set of Docker image tags (postgres, gotrue, storage-api, studio, realtime,
# kong...), so a bumped CLI asks Docker for tags you don't have -- Docker dutifully
# re-downloads the whole stack, and the previous images are left orphaned, eating
# disk. Pinning the version means the same image tags every time, so Docker reuses
# what's already local and nothing is downloaded twice.
#
# To upgrade deliberately: bump this, run the script, and expect a one-time pull.
# Reclaim the superseded images afterwards with `docker image prune` (optional).
$SupabaseCli = "supabase@2.119.0"

# Containers this project never uses -- excluded so they are never pulled or run.
#   imgproxy      storage.image_transformation is disabled in config.toml
#   edge-runtime  there is no supabase/functions/ -- no Deno functions exist
#   logflare      [analytics] enabled = false  (the CONTAINER is "logflare";
#                 "analytics" is the config section and the CLI rejects it here)
#   vector        only ships logs to logflare, which is off
# Run `npx <cli> start -x bogus` to have the CLI print the valid container names.
# Add `realtime` too if you want: nothing in either repo subscribes to it.
$SupabaseExclude = "imgproxy,edge-runtime,logflare,vector"

# Resolve paths relative to THIS script, so it works from any current directory.
$Root = $PSScriptRoot
$Api  = Join-Path $Root "hok-api"
$Web  = Join-Path $Root "hok-web"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Magenta }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor DarkGray }

# Pull URLs straight from the env files so this script never hardcodes a host --
# whatever the apps are configured to use (e.g. a LAN IP like 192.168.1.8) is
# exactly what gets printed, so nothing drifts or breaks.
function Get-EnvValue($file, $key) {
  if (-not (Test-Path $file)) { return $null }
  $line = Get-Content -LiteralPath $file | Where-Object { $_ -match "^\s*$([regex]::Escape($key))\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -replace "^\s*$([regex]::Escape($key))\s*=\s*", "").Trim().Trim('"').Trim("'")
}

# This machine's current LAN IPv4 (real Wi-Fi/Ethernet -- excludes WSL/Hyper-V/loopback).
function Get-LanIPv4 {
  try {
    $cands = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object {
      $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and
      $_.InterfaceAlias -notmatch 'vEthernet|WSL|Loopback|Bluetooth' -and
      $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)'
    }
    $pref = $cands | Where-Object { $_.InterfaceAlias -match 'Wi-?Fi|Wireless|Ethernet' } | Select-Object -First 1
    if ($pref) { return $pref.IPAddress }
    if ($cands) { return ($cands | Select-Object -First 1).IPAddress }
  } catch {}
  return $null
}

# Replace one IP literal with another inside a file, preserving everything else.
function Sync-EnvIp($file, $oldIp, $newIp) {
  if (-not (Test-Path $file)) { return }
  $content = Get-Content -LiteralPath $file -Raw
  if ($content.Contains($oldIp)) {
    [System.IO.File]::WriteAllText($file, $content.Replace($oldIp, $newIp))
    Write-Ok "$([System.IO.Path]::GetFileName($file)): $oldIp -> $newIp"
  }
}

# --- Supabase CLI version management -------------------------------------------
# Latest published CLI, or $null if npm can't be reached (offline, registry down).
# Never fatal: a failed check just means we quietly stay on the pinned version.
function Get-LatestSupabaseCli {
  # Local override: with $ErrorActionPreference = "Stop", redirecting a native
  # command's stderr turns ordinary npm chatter into a terminating error.
  $ErrorActionPreference = "Continue"
  try {
    $v = (& npm view supabase version 2>$null | Select-Object -First 1)
    if ($v) { $v = $v.ToString().Trim() }
    if ($v -match '^\d+\.\d+\.\d+$') { return $v }
  } catch {}
  return $null
}

# Rewrite the $SupabaseCli line in THIS file so the trialled version becomes the
# new pin. Written as UTF-8 *without* a BOM, matching how the file is stored --
# PowerShell's Set-Content -Encoding UTF8 would add one and corrupt the em dash
# in the header comment.
function Set-PinnedCliVersion($oldPin, $newVersion) {
  $path = $PSCommandPath
  $oldLine = '$SupabaseCli = "' + $oldPin + '"'
  $newLine = '$SupabaseCli = "supabase@' + $newVersion + '"'
  $text = [System.IO.File]::ReadAllText($path)
  if (-not $text.Contains($oldLine)) {
    Write-Host "    Could not find the pin line to update -- set it by hand: $newLine" -ForegroundColor Yellow
    return $false
  }
  [System.IO.File]::WriteAllText($path, $text.Replace($oldLine, $newLine), (New-Object System.Text.UTF8Encoding $false))
  return $true
}

$WebEnv = Join-Path $Web ".env.local"
$ApiEnv = Join-Path $Api ".env"

# --- Keep the env LAN IP pointed at THIS machine ------------------------------
# DHCP can hand the laptop a new address; when it does, the IP baked into the env
# files goes stale and the app can't reach itself (ConnectTimeout to the old IP).
# We only ever swap the IP octets -- never ports, paths, or which URLs are used --
# so CORS, portal links, and the API base URL all stay consistent and just work.
# Opt out with -NoIpSync. (127.0.0.1 / localhost values are never touched.)
if (-not $NoIpSync) {
  $lanIp = Get-LanIPv4
  $curUrl = Get-EnvValue $WebEnv "NEXT_PUBLIC_WEB_APP_URL"
  $curIp = if ($curUrl -match '(\d{1,3}(\.\d{1,3}){3})') { $Matches[1] } else { $null }
  if (-not $lanIp) {
    Write-Ok "Could not detect a LAN IP; leaving env files as-is."
  } elseif ($curIp -and $curIp -ne $lanIp -and $curIp -notmatch '^127\.') {
    Write-Step "LAN IP changed ($curIp -> $lanIp) -- syncing env files so the app can reach itself..."
    Sync-EnvIp $WebEnv $curIp $lanIp
    Sync-EnvIp $ApiEnv $curIp $lanIp
  } elseif ($curIp -eq $lanIp) {
    Write-Ok "Env LAN IP ($curIp) already matches this machine."
  }
}

# Display URLs, read from the (now-synced) env files -- never hardcoded.
$WebUrl  = Get-EnvValue $WebEnv "NEXT_PUBLIC_WEB_APP_URL"
$ApiBase = Get-EnvValue $WebEnv "NEXT_PUBLIC_API_BASE_URL"
$ApiUrl  = if ($ApiBase) { $ApiBase -replace "/api/v1/?$", "" } else { $null }
if (-not $WebUrl) { $WebUrl = "http://localhost:3400" }
if (-not $ApiUrl) { $ApiUrl = "http://localhost:4100" }
$StudioUrl = "http://localhost:54423"
if ($WebUrl -match "^https?://([^:/]+)") { $StudioUrl = "http://$($Matches[1]):54423" }

Write-Host "HOK local dev launcher" -ForegroundColor Yellow

# --- 0. Sanity: folders + Docker ------------------------------------------------
if (-not (Test-Path $Api)) { throw "Cannot find hok-api at $Api" }
if (-not (Test-Path $Web)) { throw "Cannot find hok-web at $Web" }

Write-Step "Checking Docker (required by Supabase)..."
try {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { throw "docker not ready" }
  Write-Ok "Docker is running."
} catch {
  Write-Host "    Docker isn't running. Start Docker Desktop, then re-run this script." -ForegroundColor Red
  exit 1
}

# --- 0b. Offer a newer Supabase CLI (opt-in, never automatic) -------------------
# Answering "n" (the default) keeps today's pin and downloads nothing.
$CliToUse     = $SupabaseCli
$TrialVersion = $null

if (-not $NoUpdateCheck) {
  Write-Step "Checking for a newer Supabase CLI..."
  $pinnedVersion = ($SupabaseCli -split '@')[-1]
  $latestVersion = Get-LatestSupabaseCli

  if (-not $latestVersion) {
    Write-Ok "Couldn't reach npm -- staying on pinned $pinnedVersion."
  } elseif ([version]$latestVersion -le [version]$pinnedVersion) {
    Write-Ok "Pinned $pinnedVersion is the latest."
  } else {
    Write-Host ""
    Write-Host "    Newer Supabase CLI available:  $pinnedVersion  ->  $latestVersion" -ForegroundColor Yellow
    Write-Host "    Saying yes will:"                                                   -ForegroundColor DarkGray
    Write-Host "      1. start the stack on the new images (one-time GB download)"      -ForegroundColor DarkGray
    Write-Host "      2. apply all migrations"                                          -ForegroundColor DarkGray
    Write-Host "      3. run the unit + integration suites against it"                  -ForegroundColor DarkGray
    Write-Host "      4. update the pin in this script ONLY if they pass"               -ForegroundColor DarkGray
    Write-Host "    Your current images stay on disk, so this is reversible."           -ForegroundColor DarkGray
    $answer = Read-Host "    Use $latestVersion for this run? (y/N)"
    if ($answer -match '^\s*(y|yes)\s*$') {
      $TrialVersion = $latestVersion
      $CliToUse = "supabase@$latestVersion"
      Write-Ok "Trialling $latestVersion -- stopping the current stack first..."
      Push-Location $Api
      try { & npx $SupabaseCli stop } catch { } finally { Pop-Location }
    } else {
      Write-Ok "Staying on pinned $pinnedVersion."
    }
  }
}

# --- 1. Supabase (DB + Auth + Storage) -----------------------------------------
# Supabase commands run from hok-api, where supabase/ (config + migrations) lives.
Push-Location $Api
try {
  if ($Reset) {
    Write-Step "Resetting Supabase DB (wipes local data + re-applies all migrations)..."
    npx $CliToUse db reset
  } else {
    Write-Step "Starting Supabase (Postgres + Auth + Storage)..."
    npx $CliToUse start -x $SupabaseExclude
    Write-Step "Applying database migrations..."
    npx $CliToUse migration up
  }

  if ($Seed) {
    Write-Step "Seeding demo data..."
    npm run seed
  }
} finally {
  Pop-Location
}

# --- 1b. A trialled CLI has to earn its pin -------------------------------------
# Only unit + integration run here. test:rbac needs the API server up in another
# terminal (see tests/integration/README.md), which hasn't launched yet -- but
# integration already exercises real Postgres + real GoTrue, which is precisely
# what a Supabase version bump can break.
if ($TrialVersion) {
  Write-Step "Verifying supabase@$TrialVersion against the test suites..."
  $testsPassed = $true
  Push-Location $Api
  try {
    npm run test:unit
    if ($LASTEXITCODE -ne 0) { $testsPassed = $false }
    if ($testsPassed) {
      npm run test:integration
      if ($LASTEXITCODE -ne 0) { $testsPassed = $false }
    }
  } finally {
    Pop-Location
  }

  if ($testsPassed) {
    if (Set-PinnedCliVersion $SupabaseCli $TrialVersion) {
      Write-Host "`n    Tests passed -- pinned to supabase@$TrialVersion." -ForegroundColor Green
      Write-Host "    Reclaim the superseded images with: docker image prune" -ForegroundColor DarkGray
      Write-Host "    Worth also running (once the API window is up): npm run test:rbac" -ForegroundColor DarkGray
    }
  } else {
    Write-Host "`n    Tests FAILED on supabase@$TrialVersion -- pin left unchanged." -ForegroundColor Red
    Write-Host "    Servers were not launched. To go back to the known-good version:" -ForegroundColor Yellow
    Write-Host "      npx $CliToUse stop"                    -ForegroundColor DarkGray
    Write-Host "      .\start-dev.ps1 -NoUpdateCheck"        -ForegroundColor DarkGray
    Write-Host "    Add -Reset if the newer Postgres left the local data volume unusable." -ForegroundColor DarkGray
    exit 1
  }
}

# --- 2. Launch the two dev servers, each in its own window ----------------------
# Separate windows so you can read each server's logs and Ctrl+C them independently.
Write-Step "Launching backend API (hok-api) in a new window..."
Start-Process -FilePath "powershell" -WorkingDirectory $Api `
  -ArgumentList "-NoExit", "-Command", "Write-Host 'HOK API  ($ApiUrl)' -ForegroundColor Cyan; npm run dev"

Write-Step "Launching frontend (hok-web) in a new window..."
Start-Process -FilePath "powershell" -WorkingDirectory $Web `
  -ArgumentList "-NoExit", "-Command", "Write-Host 'HOK Web  ($WebUrl)' -ForegroundColor Cyan; npm run dev"

# --- 3. Summary -----------------------------------------------------------------
Write-Host "`nAll set. Two new windows are starting the API and web servers." -ForegroundColor Green
Write-Host ""
Write-Host "  Web app          : $WebUrl"                         -ForegroundColor White
Write-Host "  API              : $ApiUrl"                         -ForegroundColor White
Write-Host "  Supabase Studio  : $StudioUrl"                      -ForegroundColor White
Write-Host ""
Write-Host "  Local logins after start-dev.ps1 -Seed (all password: Hok@2026):" -ForegroundColor White
Write-Host "    Admin                 admin@hok.test"          -ForegroundColor DarkGray
Write-Host "    Social Media Manager  rohan.smm@hok.test"      -ForegroundColor DarkGray
Write-Host "    Marketing Manager     vikram.mm@hok.test"      -ForegroundColor DarkGray
Write-Host "    Marketing Agent       neha.agent@hok.test"     -ForegroundColor DarkGray
Write-Host "    Developer             arjun.dev@hok.test"      -ForegroundColor DarkGray
Write-Host "    Editor                meera.editor@hok.test"   -ForegroundColor DarkGray
Write-Host "  (Sign-in itself works from milestone M2.)"       -ForegroundColor DarkGray
Write-Host ""
Write-Host "  On your phone (same Wi-Fi), open $WebUrl"         -ForegroundColor White
Write-Host ""
Write-Host "  To STOP: close the two server windows, then run (in hok-api):" -ForegroundColor White
Write-Host "    npx $SupabaseCli stop"                                -ForegroundColor DarkGray
Write-Host ""

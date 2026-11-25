#Requires -Version 5.1
#Requires -RunAsAdministrator

<#
.SYNOPSIS
Adds Bikalpo's local development hostnames to the Windows hosts file.
.EXAMPLE
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local-hosts.ps1
.EXAMPLE
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local-hosts.ps1 -WhatIf
.NOTES
Run from PowerShell opened as Administrator. Web portals use port 3001;
the API uses port 3000. Ports belong in URLs, never in the hosts file.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'
$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$domains = @(
    'bikalpo.localhost'
    'api.bikalpo.localhost'
    'shop.bikalpo.localhost'
    'warehouse.bikalpo.localhost'
    'delivery.bikalpo.localhost'
    'sales.bikalpo.localhost'
)

# Read active mappings, including lines containing multiple aliases.
$addressesByDomain = @{}
foreach ($line in (Get-Content -LiteralPath $hostsPath)) {
    $activeLine = ($line -split '#', 2)[0].Trim()
    if (-not $activeLine) { continue }

    $fields = $activeLine -split '\s+'
    if ($fields.Count -lt 2) { continue }

    foreach ($domain in $fields[1..($fields.Count - 1)]) {
        if ($domains -contains $domain) {
            $addressesByDomain[$domain] = @($addressesByDomain[$domain]) + $fields[0]
        }
    }
}

$missingDomains = @()
foreach ($domain in $domains) {
    $addresses = @($addressesByDomain[$domain] | Where-Object { $_ })
    $conflicts = @($addresses | Where-Object { $_ -ne '127.0.0.1' })
    if ($conflicts.Count -gt 0) {
        throw "$domain already maps to $($conflicts -join ', ') in $hostsPath. Update that mapping to 127.0.0.1 before rerunning. No changes were made."
    }
    if ($addresses -notcontains '127.0.0.1') {
        $missingDomains += $domain
    }
}

if ($missingDomains.Count -eq 0) {
    Write-Host "All $($domains.Count) Bikalpo hostnames already map to 127.0.0.1. No changes needed."
    return
}

if (-not $PSCmdlet.ShouldProcess($hostsPath, "Back up and add mappings for: $($missingDomains -join ', ')")) {
    return
}

$backupPath = '{0}.bikalpo.{1}.bak' -f $hostsPath, (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
Copy-Item -LiteralPath $hostsPath -Destination $backupPath

# Append without rewriting existing entries or comments. Add-Content detects
# the existing file encoding. The leading newline also handles files with no
# final newline, so the first new entry cannot merge with an existing line.
$newLine = [Environment]::NewLine
$entries = @($missingDomains | ForEach-Object { "127.0.0.1`t$_" })
$block = $newLine + '# Bikalpo local development' + $newLine + ($entries -join $newLine)
Add-Content -LiteralPath $hostsPath -Value $block

Write-Host "Added $($missingDomains.Count) hostname(s). Backup: $backupPath"
& (Join-Path $env:SystemRoot 'System32\ipconfig.exe') /flushdns
if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Hosts entries were added, but the DNS cache could not be cleared. Run ipconfig /flushdns manually.'
}

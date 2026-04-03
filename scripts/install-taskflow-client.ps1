Param(
  [string]$HostName = "taskflow.local",
  [string]$ServerIP = "192.168.99.101",
  [string]$RootCrtUrl = "https://taskflow.local/pki/authorities/local/root.crt"
)

function Ensure-Admin {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) {
    throw "Run this script as Administrator."
  }
}

function Ensure-HostsEntry {
  $hostsPath = "$env:WINDIR\System32\drivers\etc\hosts"
  $line = "$ServerIP`t$HostName"

  $lines = Get-Content -Path $hostsPath
  $alreadyPresent = $false

  foreach ($l in $lines) {
    $t = $l.Trim()
    if ($t.Length -eq 0) { continue }
    if ($t.StartsWith("#")) { continue }

    # Normalize whitespace and compare as tokens: <ip> <hostname>
    $parts = $t -split '\s+'
    if ($parts.Length -ge 2 -and $parts[0] -eq $ServerIP -and $parts[1] -eq $HostName) {
      $alreadyPresent = $true
      break
    }
  }

  if (-not $alreadyPresent) {
    Write-Host "Adding hosts entry: $line"
    Add-Content -Path $hostsPath -Value $line
  } else {
    Write-Host "Hosts entry already present."
  }
}

function Install-RootCA {
  $tmp = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "taskflow-root.crt")
  # Cert будет изначально не доверен (tls internal), поэтому временно пропускаем проверку.
  # В Windows PowerShell параметра -SkipCertificateCheck может не существовать,
  # поэтому используем коллбек проверки сертификата.
  $oldCallback = [System.Net.ServicePointManager]::ServerCertificateValidationCallback
  try {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    Invoke-WebRequest -Uri $RootCrtUrl -OutFile $tmp -UseBasicParsing
  } finally {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = $oldCallback
  }

  # Install into Windows trusted root store
  Write-Host "Installing root CA into Trusted Root Certification Authorities..."
  certutil -addstore -f "Root" $tmp | Out-Null
  Write-Host "Done. You may need to restart the browser."
}

Ensure-Admin
Ensure-HostsEntry
Install-RootCA


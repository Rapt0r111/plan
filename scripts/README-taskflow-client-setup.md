## TaskFlow client setup (TLS + PWA secure context)

TaskFlow PWA uses a service worker and it requires a **secure context**.
For `https://taskflow.local/` with Caddy `tls internal`, each client must trust the local root CA.

### Windows
1. Copy `scripts/install-taskflow-client.ps1` to the client machine.
2. Run it as Administrator:
   - PowerShell: `Set-ExecutionPolicy -Scope Process Bypass`
   - `.\install-taskflow-client.ps1`

This script:
- Adds `192.168.99.101 taskflow.local` to the client's `hosts` file (if missing)
- Downloads `https://taskflow.local/pki/authorities/local/root.crt`
- Imports it into Windows Trusted Root Certification Authorities

### Linux
1. Copy `scripts/install-taskflow-client-linux.sh` to the client machine.
2. Run with sudo:
   - `sudo bash install-taskflow-client-linux.sh`

This script:
- Adds `192.168.99.101 taskflow.local` to `/etc/hosts` (if missing)
- Downloads the root CA
- Installs it into `/usr/local/share/ca-certificates/` and runs `update-ca-certificates`

### After setup
- Open `https://taskflow.local/` in the browser.
- Confirm in DevTools → Application → Service Workers that the service worker is `activated`.


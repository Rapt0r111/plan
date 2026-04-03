#!/usr/bin/env bash
set -euo pipefail

HOSTNAME="${1:-taskflow.local}"
SERVER_IP="${2:-192.168.99.101}"
ROOT_CRT_URL="https://${HOSTNAME}/pki/authorities/local/root.crt"

ROOT_CERT_PATH="/usr/local/share/ca-certificates/${HOSTNAME}.crt"

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root (or with sudo)."
    exit 1
  fi
}

ensure_hosts_entry() {
  local hosts="/etc/hosts"
  local line="${SERVER_IP} ${HOSTNAME}"
  if ! grep -Eq "^[[:space:]]*${SERVER_IP}[[:space:]]+${HOSTNAME}[[:space:]]*$" "$hosts"; then
    echo "Adding hosts entry: ${line}"
    echo "$line" >> "$hosts"
  else
    echo "Hosts entry already present."
  fi
}

install_root_ca() {
  echo "Downloading root CA from: ${ROOT_CRT_URL}"
  # Cert is initially untrusted (tls internal), so use --insecure for bootstrap.
  curl -fsSL --insecure "$ROOT_CRT_URL" -o /tmp/taskflow-root.crt
  echo "Installing into: ${ROOT_CERT_PATH}"
  cp /tmp/taskflow-root.crt "$ROOT_CERT_PATH"
  rm -f /tmp/taskflow-root.crt
  update-ca-certificates
}

require_root
ensure_hosts_entry
install_root_ca
echo "Done. You may need to restart the browser."


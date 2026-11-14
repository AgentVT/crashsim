#!/usr/bin/env bash
# Installs the CrashSim co-op relay on this server: Node (if missing), the relay as a systemd service on 127.0.0.1:3021
# (port 3020 belongs to pollbooth on this VPS) and an nginx route so the game at https://crash.systex.io reaches it at wss://crash.systex.io/mp.
# Run as root from the folder holding server.js and package.json:  bash install-crash-mp.sh
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST=/opt/crash-mp
SITE=/etc/nginx/sites-available/crash

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

mkdir -p "$DEST"
cp "$SRC/server.js" "$SRC/package.json" "$DEST/"
cd "$DEST" && npm install --omit=dev --no-audit --no-fund

cat > /etc/systemd/system/crash-mp.service <<UNIT
[Unit]
Description=CrashSim co-op relay
After=network.target

[Service]
WorkingDirectory=$DEST
ExecStart=$(command -v node) $DEST/server.js
Environment=PORT=3021 HOST=127.0.0.1
Restart=always
RestartSec=2
User=nobody
Group=nogroup

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now crash-mp
systemctl restart crash-mp

mkdir -p /etc/nginx/snippets
cat > /etc/nginx/snippets/crash-mp.conf <<'NGX'
location /mp {
    proxy_pass http://127.0.0.1:3021;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
NGX
if [ -f "$SITE" ]; then
  if ! grep -q 'snippets/crash-mp.conf' "$SITE"; then
    cp "$SITE" "$SITE.bak.$(date +%s)"
    sed -i '/server_name[[:space:]]\+crash\.systex\.io;/a\    include snippets/crash-mp.conf;' "$SITE"
  fi
else
  echo "WARNING: $SITE not found. Add 'include snippets/crash-mp.conf;' inside the crash.systex.io server block yourself."
fi
nginx -t && systemctl reload nginx

sleep 1
systemctl --no-pager --lines=3 status crash-mp | head -5
echo
echo "Done. Co-op relay: wss://crash.systex.io/mp   Logs: journalctl -u crash-mp -f"

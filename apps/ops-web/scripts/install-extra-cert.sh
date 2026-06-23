#!/usr/bin/env bash
set -euo pipefail

CERT_SOURCE_DIR="/home/REDACTED_CONFIGURE_LOCALLY/.acme.sh/git.infintraining.work_ecc"
CERT_TARGET_DIR="/etc/nginx/ssl/infini-extra"
PLATFORM_CONF="/etc/nginx/sites-enabled/infini-platform"
GIT_CONF="/etc/nginx/sites-enabled/infini-git"
BACKUP_DIR="/home/REDACTED_CONFIGURE_LOCALLY/deploy-backups/nginx"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$CERT_TARGET_DIR" "$BACKUP_DIR"
cp "$CERT_SOURCE_DIR/fullchain.cer" "$CERT_TARGET_DIR/fullchain.cer"
cp "$CERT_SOURCE_DIR/git.infintraining.work.key" "$CERT_TARGET_DIR/privkey.key"
chmod 644 "$CERT_TARGET_DIR/fullchain.cer"
chmod 600 "$CERT_TARGET_DIR/privkey.key"

cp "$PLATFORM_CONF" "$BACKUP_DIR/infini-platform.before-extra-cert.$TS.conf"
cp "$GIT_CONF" "$BACKUP_DIR/infini-git.before-extra-cert.$TS.conf"

python3 - <<'PY'
from pathlib import Path

extra_cert = "/etc/nginx/ssl/infini-extra/fullchain.cer"
extra_key = "/etc/nginx/ssl/infini-extra/privkey.key"
old_cert = "/etc/letsencrypt/live/infintraining.work/fullchain.pem"
old_key = "/etc/letsencrypt/live/infintraining.work/privkey.pem"

platform = Path("/etc/nginx/sites-enabled/infini-platform")
text = platform.read_text()
marker = "server_name download.infintraining.work;"
pos = text.index(marker)
start = text.rfind("server {", 0, pos)
end = text.find("\nserver {", pos)
if end == -1:
    end = len(text)
block = text[start:end]
block = block.replace(old_cert, extra_cert).replace(old_key, extra_key)
platform.write_text(text[:start] + block + text[end:])

git = Path("/etc/nginx/sites-enabled/infini-git")
gtext = git.read_text().replace(old_cert, extra_cert).replace(old_key, extra_key)
git.write_text(gtext)
PY

nginx -t
systemctl reload nginx
openssl x509 -in "$CERT_TARGET_DIR/fullchain.cer" -noout -subject -dates -ext subjectAltName
echo "installed-extra-cert-$TS"

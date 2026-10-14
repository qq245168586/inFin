#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "stage-host.sh must run as root" >&2
  exit 1
fi

if ss -lnt | awk '{print $4}' | grep -Eq '(^|:)3100$|(^|:)3205$|(^|:)8083$'; then
  echo "One of the Infini internal ports is already in use" >&2
  ss -lntp | grep -E ':(3100|3205|8083)\b' || true
  exit 1
fi

getent group nginx >/dev/null 2>&1 || {
  echo "nginx group is required before staging Infini" >&2
  exit 1
}

if ! id infini >/dev/null 2>&1; then
  useradd --system --home-dir /srv/infini-platform --shell /sbin/nologin infini
fi
usermod -a -G nginx infini

install -d -o infini -g infini -m 0755 \
  /srv/infini-platform \
  /srv/infini-platform/apps/server \
  /srv/infini-platform/apps/mqtt-client \
  /srv/infini-platform/packages/shared \
  /var/lib/infini \
  /var/lib/infini/backups \
  /var/lib/infini/media \
  /var/lib/infini/app-packages \
  /var/lib/infini/app-packages-replaced \
  /var/lib/infini/tv-diagnostics \
  /var/lib/infini/mqtt-logs

install -d -o root -g infini -m 0750 /etc/infini
install -d -o root -g nginx -m 0750 \
  /etc/nginx/ssl/api-rsa \
  /etc/nginx/ssl/infini-web-rsa
install -d -o nginx -g nginx -m 0755 /var/lib/infini-acme/http

install -d -o infini -g nginx -m 0755 /var/www/infini
for site in admin course coach ops download; do
  install -d -o infini -g nginx -m 0755 "/var/www/infini/${site}"
done
install -d -o infini -g nginx -m 0755 /var/www/infini/course/simulator

echo "Infini host directories staged without starting or reloading services."

#!/usr/bin/env bash

set -euo pipefail

SUDO_PASSWORD="REDACTED_CONFIGURE_LOCALLY"

sudo_cmd() {
  echo "$SUDO_PASSWORD" | sudo -S "$@"
}

echo "test-ok" > /tmp/git-acme-test
sudo_cmd mkdir -p /var/www/letsencrypt/.well-known/acme-challenge
sudo_cmd cp /tmp/git-acme-test /var/www/letsencrypt/.well-known/acme-challenge/test-git
sudo_cmd chown -R www-data:www-data /var/www/letsencrypt
sudo_cmd chmod -R a+rX /var/www/letsencrypt

cat > /tmp/infini-git-http.conf <<'EOF_NGINX'
server {
  listen 80;
  listen [::]:80;
  server_name git.infintraining.work;

  location ^~ /.well-known/acme-challenge/ {
    root /var/www/letsencrypt;
    default_type "text/plain";
    try_files $uri =404;
  }

  location / {
    return 301 https://$host$request_uri;
  }
}
EOF_NGINX

sudo_cmd cp /tmp/infini-git-http.conf /etc/nginx/sites-enabled/infini-git
sudo_cmd nginx -t
sudo_cmd systemctl reload nginx

echo "---LOCAL---"
curl -s -H "Host: git.infintraining.work" http://127.0.0.1/.well-known/acme-challenge/test-git
echo
echo "---PUBLIC---"
curl -s http://git.infintraining.work/.well-known/acme-challenge/test-git || true
echo

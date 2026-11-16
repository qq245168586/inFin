#!/usr/bin/env bash
set -euo pipefail

stamp="$(date +%Y%m%d-%H%M%S)"
files=(
  "/etc/nginx/nginx.conf"
  "/etc/letsencrypt/options-ssl-nginx.conf"
  "/etc/nginx/sites-enabled/infini-platform"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    sudo cp "$file" "${file}.bak-tv-tls12-${stamp}"
    sudo perl -0pi -e 's/ssl_protocols\s+TLSv1\.2\s+TLSv1\.3\s*;/ssl_protocols TLSv1.2; # TV TLS1.2 rescue/g' "$file"
  fi
done

sudo nginx -t
sudo systemctl reload nginx
sudo nginx -T 2>/dev/null | grep -n 'ssl_protocols\|server_name api.infintraining.work\|location /mqtt' | head -80

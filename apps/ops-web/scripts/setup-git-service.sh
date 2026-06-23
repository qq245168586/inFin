#!/usr/bin/env bash

set -euo pipefail

GITEA_VERSION="1.22.6"
GITEA_DOMAIN="git.infintraining.work"
GITEA_PORT="3001"
ADMIN_USER="13689547720"
ADMIN_PASSWORD="REDACTED_CONFIGURE_LOCALLY"
ADMIN_EMAIL="245168586+git@qq.com"
LETSENCRYPT_EMAIL="245168586@qq.com"
SUDO_PASSWORD="REDACTED_CONFIGURE_LOCALLY"

sudo_cmd() {
  echo "$SUDO_PASSWORD" | sudo -S "$@"
}

if ! id git >/dev/null 2>&1; then
  sudo_cmd adduser --system --shell /bin/bash --gecos "Git Version Control" --group --disabled-password --home /home/git git
fi

sudo_cmd mkdir -p /var/lib/gitea/custom /var/lib/gitea/data /var/lib/gitea/log /etc/gitea /var/www/letsencrypt

if ! test -x /usr/local/bin/gitea || ! /usr/local/bin/gitea --version | grep -q "$GITEA_VERSION"; then
  curl -L --fail --show-error -o /tmp/gitea "https://dl.gitea.com/gitea/$GITEA_VERSION/gitea-$GITEA_VERSION-linux-amd64"
  sudo_cmd install -m 0755 /tmp/gitea /usr/local/bin/gitea
fi

SECRET_KEY="$(/usr/local/bin/gitea generate secret SECRET_KEY)"
INTERNAL_TOKEN="$(/usr/local/bin/gitea generate secret INTERNAL_TOKEN)"

cat > /tmp/gitea-app.ini <<EOF_INI
APP_NAME = Infini Git
RUN_USER = git
WORK_PATH = /var/lib/gitea

[server]
APP_DATA_PATH = /var/lib/gitea/data
DOMAIN = $GITEA_DOMAIN
SSH_DOMAIN = $GITEA_DOMAIN
HTTP_ADDR = 127.0.0.1
HTTP_PORT = $GITEA_PORT
ROOT_URL = https://$GITEA_DOMAIN/
DISABLE_SSH = false
SSH_PORT = 22
LFS_START_SERVER = true
LFS_JWT_SECRET = $INTERNAL_TOKEN
OFFLINE_MODE = true

[database]
DB_TYPE = sqlite3
PATH = /var/lib/gitea/data/gitea.db

[repository]
ROOT = /var/lib/gitea/data/gitea-repositories
DEFAULT_PRIVATE = private

[security]
INSTALL_LOCK = true
SECRET_KEY = $SECRET_KEY
INTERNAL_TOKEN = $INTERNAL_TOKEN
PASSWORD_HASH_ALGO = pbkdf2

[service]
DISABLE_REGISTRATION = true
REQUIRE_SIGNIN_VIEW = true
REGISTER_EMAIL_CONFIRM = false
ENABLE_NOTIFY_MAIL = false
ALLOW_ONLY_EXTERNAL_REGISTRATION = false

[openid]
ENABLE_OPENID_SIGNIN = false
ENABLE_OPENID_SIGNUP = false

[session]
PROVIDER = file

[log]
MODE = console,file
LEVEL = Info
ROOT_PATH = /var/lib/gitea/log

[actions]
ENABLED = false
EOF_INI

sudo_cmd cp /tmp/gitea-app.ini /etc/gitea/app.ini
sudo_cmd chown -R git:git /var/lib/gitea /etc/gitea
sudo_cmd chmod 750 /var/lib/gitea /etc/gitea
sudo_cmd chmod 640 /etc/gitea/app.ini

cat > /tmp/gitea.service <<EOF_SERVICE
[Unit]
Description=Gitea - Git with a cup of tea
After=network.target
Wants=network.target

[Service]
RestartSec=2s
Type=simple
User=git
Group=git
WorkingDirectory=/var/lib/gitea
ExecStart=/usr/local/bin/gitea web --config /etc/gitea/app.ini
Restart=always
Environment=USER=git HOME=/home/git GITEA_WORK_DIR=/var/lib/gitea

[Install]
WantedBy=multi-user.target
EOF_SERVICE

sudo_cmd cp /tmp/gitea.service /etc/systemd/system/gitea.service
sudo_cmd systemctl daemon-reload
sudo_cmd systemctl enable --now gitea
sleep 3

if ! sudo -u git /usr/local/bin/gitea admin user list --config /etc/gitea/app.ini | grep -q "^$ADMIN_USER"; then
  sudo -u git /usr/local/bin/gitea admin user create \
    --config /etc/gitea/app.ini \
    --username "$ADMIN_USER" \
    --password "$ADMIN_PASSWORD" \
    --email "$ADMIN_EMAIL" \
    --admin \
    --must-change-password=false
else
  sudo -u git /usr/local/bin/gitea admin user change-password \
    --config /etc/gitea/app.ini \
    --username "$ADMIN_USER" \
    --password "$ADMIN_PASSWORD"
fi

sudo_cmd certbot certonly \
  --webroot \
  -w /var/www/letsencrypt \
  -d "$GITEA_DOMAIN" \
  --non-interactive \
  --agree-tos \
  --email "$LETSENCRYPT_EMAIL" \
  --keep-until-expiring

cat > /tmp/infini-git-nginx.conf <<EOF_NGINX
server {
  listen 80;
  listen [::]:80;
  server_name $GITEA_DOMAIN;

  location ^~ /.well-known/acme-challenge/ {
    root /var/www/letsencrypt;
    default_type "text/plain";
    try_files \$uri =404;
  }

  location / {
    return 301 https://\$host\$request_uri;
  }
}

server {
  listen 443 ssl;
  listen [::]:443 ssl;
  server_name $GITEA_DOMAIN;

  client_max_body_size 1024m;

  ssl_certificate /etc/letsencrypt/live/$GITEA_DOMAIN/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/$GITEA_DOMAIN/privkey.pem;
  include /etc/letsencrypt/options-ssl-nginx.conf;
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

  location / {
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_pass http://127.0.0.1:$GITEA_PORT;
  }
}
EOF_NGINX

sudo_cmd cp /tmp/infini-git-nginx.conf /etc/nginx/sites-enabled/infini-git
sudo_cmd nginx -t
sudo_cmd systemctl reload nginx

systemctl is-active gitea
curl -sI "http://127.0.0.1:$GITEA_PORT/" | head -5
curl -ksI -H "Host: $GITEA_DOMAIN" https://127.0.0.1/ | head -8

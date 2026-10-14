#!/usr/bin/env python3
"""Install isolated Infini configuration while preserving existing TMY routes."""
import json
import os
from pathlib import Path
import secrets
import shlex
import shutil
import subprocess
import tarfile

bundle = Path(__file__).resolve().parent
private_root = Path('/var/tmp/infini-private-20261014')
private_root.mkdir(mode=0o700, exist_ok=True)
private_archive = Path('/var/tmp/infini-private-config-20261014.tgz')
private_archive.chmod(0o600)
with tarfile.open(private_archive) as archive:
    archive.extractall(private_root, filter='data')

def parse_environment(file):
    result = {}
    for line in file.read_text().splitlines():
        if line.strip().startswith('Environment='):
            for item in shlex.split(line.strip().removeprefix('Environment=')):
                key, value = item.split('=', 1)
                result[key] = value
    return result

def write_environment(file, values):
    file.write_text(''.join(f'{key}={json.dumps(value)}\n' for key, value in values.items()))
    shutil.chown(file, user='root', group='infini')
    file.chmod(0o640)

server = parse_environment(private_root / 'home/REDACTED_CONFIGURE_LOCALLY/oss.conf')
gateway = parse_environment(private_root / 'home/REDACTED_CONFIGURE_LOCALLY/infini-platform-mqtt-client.conf')
token = gateway.get('MQTT_CLIENT_HTTP_TOKEN') or secrets.token_hex(32)
server.update({
    'MQTT_CLIENT_HTTP_TOKEN': token,
    'INFINI_PUBLIC_BASE_URL': 'https://114.215.185.184/infini',
    'MQTT_URL': 'ws://127.0.0.1:8083/mqtt',
    'MQTT_WSS_URL': 'wss://114.215.185.184/infini/mqtt',
})
gateway = {key: value for key, value in gateway.items() if key.startswith('MQTT_')}
gateway.update({
    'MQTT_CLIENT_HTTP_TOKEN': token,
    'MQTT_URL': 'ws://127.0.0.1:8083/mqtt',
    'MQTT_WSS_URL': 'wss://114.215.185.184/infini/mqtt',
})
write_environment(Path('/etc/infini/server.env'), server)
write_environment(Path('/etc/infini/mqtt-client.env'), gateway)

for name in ['infini-platform.service', 'infini-mqtt-client.service']:
    shutil.copyfile(bundle / name, Path('/etc/systemd/system') / name)

emqx = Path('/etc/emqx/emqx.conf')
shutil.copyfile(emqx, emqx.with_suffix('.conf.pre-infini'))
emqx.write_text('''node {
  name = "emqx@127.0.0.1"
  cookie = "''' + secrets.token_hex(32) + '''"
  data_dir = "/var/lib/emqx"
}
cluster { discovery_strategy = manual }
dashboard.listeners.http.bind = "127.0.0.1:18083"
include "infini-listeners.conf"
''')
shutil.copyfile(bundle / 'infini-emqx-listeners.conf', '/etc/emqx/infini-listeners.conf')
emqx_config = Path('/var/lib/emqx/configs')
emqx_config.mkdir(exist_ok=True)
shutil.copyfile(private_root / 'var/lib/emqx/configs/cluster.hocon', emqx_config / 'cluster.hocon')
subprocess.run(['chown', '-R', 'emqx:emqx', '/var/lib/emqx/configs'], check=True)
Path('/etc/systemd/system/emqx.service.d').mkdir(exist_ok=True)
shutil.copyfile(bundle / 'infini-emqx.service.conf', '/etc/systemd/system/emqx.service.d/infini.conf')

Path('/etc/nginx/snippets').mkdir(exist_ok=True)
shutil.copyfile(bundle / 'infini-http.conf', '/etc/nginx/conf.d/infini-http.conf')
for name in ['infini-api-proxy.conf', 'infini-media-location.conf', 'infini-routes.conf']:
    shutil.copyfile(bundle / name, Path('/etc/nginx/snippets') / name)
nginx = Path('/etc/nginx/conf.d/tmy-phase2.conf')
original = nginx.read_text()
include = ' include /etc/nginx/snippets/infini-routes.conf;\n'
anchor = ' ssl_protocols TLSv1.2 TLSv1.3;\n'
if include not in original:
    if original.count(anchor) != 1:
        raise RuntimeError('Unexpected TMY TLS layout; abort route installation')
    shutil.copyfile(nginx, nginx.with_suffix('.conf.pre-infini'))
    nginx.write_text(original.replace(anchor, anchor + include))
try:
    subprocess.run(['nginx', '-t'], check=True)
except Exception:
    nginx.write_text(original)
    raise

subprocess.run(['systemctl', 'daemon-reload'], check=True)
print('Infini configuration installed. TMY routes preserved; services not started.')

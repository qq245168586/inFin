# Infini ECS Migration Bundle

Target instance: `i-bp1gy4to0n4dh5gk7tuw`

This bundle stages Infini beside the existing TMY services. It does not change
DNS and it does not stop the old production host.

## Layout

- Runtime: `/srv/infini-platform`
- Mutable data: `/var/lib/infini`
- Environment files: `/etc/infini`
- Web releases: `/var/www/infini/*`
- API: `127.0.0.1:3100`
- MQTT gateway: `127.0.0.1:3205`
- EMQX WebSocket: `127.0.0.1:8083`

## Stage Order

1. Run `stage-host.sh` through Workbench.
2. Install pnpm and a supported EMQX 5.x package.
3. Upload runtime, web builds, certificates and environment files.
4. Copy the first data snapshot while old production remains online.
5. Include `infini-routes.conf` in the existing TMY HTTPS server and validate
   with `nginx -t`.
6. Start Infini services and test the `/infini/*` paths before cutover.

## Cutover Order

1. Record counts and checksums on the old host.
2. Stop old `infini-platform` to freeze JSON DB writes; retain the old MQTT
   gateway temporarily for the TV migration command.
3. Copy the final data delta and verify checksums.
4. Start the new Infini services and run `verify-host.sh`.
5. Publish Web builds and TV package configured for `https://114.215.185.184/infini`.
6. Upgrade IDLE TVs through the existing MQTT channel, then stop old MQTT services.
7. Keep the old host stopped but intact during the observation window.

## Rollback

1. Restore Web and TV builds that use the old production endpoints.
2. Stop new Infini services.
3. Start old `infini-platform`, `infini-mqtt-client` and EMQX services.
4. Verify health, current session and MQTT connectivity.

Never copy a new-host `db.json` back to the old host without first stopping all
writers and taking a backup of both versions.

## Current State

Staging and API/HTTPS/WSS checks passed on 2026-10-14. Production cutover is
pending explicit approval for briefly stopping the old API. The old host is
still the production writer. Staging logins and APK registrations must be
discarded by the final DB delta, then register the final TV APK once through
the live API. This prevents a second process from overwriting live DB state.

# Production Nginx

Infini shares `https://114.215.185.184` with TMY under `/infini/*`.

Install the versioned configuration from
`tools/migration/ecs-20261014/infini-routes.conf` as
`/etc/nginx/snippets/infini-routes.conf`, and include it only inside the existing
IP HTTPS server. Install `infini-http.conf` in the `http` configuration context.

The existing TMY server provides the IP certificate and its automatic renewal.
Keep its `/`, `/api/`, `/git/`, `/h5/`, compliance and update routes intact.
After `nginx -t`, reload Nginx to activate the Infini locations.

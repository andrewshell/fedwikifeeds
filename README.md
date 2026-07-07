# fedwikifeeds
RSS 2.0 feeds and OPML subscription lists for the FedWiki network

[![PDD status](https://www.0pdd.com/svg?name=andrewshell/fedwikifeeds)](https://www.0pdd.com/p?name=andrewshell/fedwikifeeds)

- [Feeds](https://feeds.fedwikiriver.com/)
- [River](https://fedwikiriver.com/)

## Configuration

fedwikifeeds stores two hand-curated config files in `DATA_DIR` (default:
`./data`), alongside its feed/roster cache. Both are created empty (`[]`) on
first run if missing.

### `blacklist.json`

An array of lowercase domains to exclude from the aggregated feed. Any
FedWiki site matching one of these domains is dropped from
`river.opml`/`river.json`/etc.

```json
["spammy-site.example.com", "another-bad-site.example.com"]
```

### `cname.json`

An array of `[hostname, path, scheme?]` tuples used to serve a custom
domain's root (`/`) as an alias for one of this app's own paths — e.g. so
`feeds.fedwikiriver.com` can serve `/river.opml` at its root instead of
`/`.

- `hostname` — the custom domain, matched against the request's `Host` header.
- `path` — the internal path to serve when `hostname` is requested at `/`.
- `scheme` (optional) — protocol prefix used when redirecting the app's own
  domain to `hostname`; defaults to `http://`.

```json
[
  ["feeds.fedwikiriver.com", "/river.opml", "https://"]
]
```

With this entry:
- A request to `https://feeds.fedwikiriver.com/` internally serves the
  content of `/river.opml`.
- A request to the app's own domain at `/river.opml` redirects (301) to
  `https://feeds.fedwikiriver.com/`.
- A request to `/allfeeds.opml` on `feeds.fedwikiriver.com` redirects (301)
  to `/river.opml` — a legacy path kept for old subscribers.

## Docker

Published to `ghcr.io/andrewshell/fedwikifeeds`. Example [Dockge](https://github.com/louislam/dockge) stack:

```yaml
services:
  fedwikifeeds:
    image: ghcr.io/andrewshell/fedwikifeeds:latest
    restart: unless-stopped
    ports:
      - 3000:3000
    volumes:
      - fedwikifeeds-data:/app/data
    env_file:
      - .env
networks: {}

volumes:
  fedwikifeeds-data:
```

`.env` should set at least `DOC_ROOT` (the public URL this instance advertises). See
[`examples/dockge/compose.yaml`](examples/dockge/compose.yaml) for a fully annotated
version and [`scripts/README.md`](scripts/README.md) for building/pushing the image.

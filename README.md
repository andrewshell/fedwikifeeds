# fedwikifeeds
RSS 2.0 feeds and OPML subscription lists for the FedWiki network

[![PDD status](https://www.0pdd.com/svg?name=andrewshell/fedwikifeeds)](https://www.0pdd.com/p?name=andrewshell/fedwikifeeds)

- [Feeds](https://feeds.fedwikiriver.com/)
- [River](https://fedwikiriver.com/)

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

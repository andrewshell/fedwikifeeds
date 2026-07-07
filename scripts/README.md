# Scripts

## docker-build-push.sh

Builds a Docker image for fedwikifeeds and pushes it to the GitHub Container
Registry as `ghcr.io/andrewshell/fedwikifeeds`.

### Features

- ✅ **Quality checks** — runs unit tests before building
- 🐳 **Docker validation** — checks Docker is running and you're authenticated to ghcr.io
- 🏷️ **Smart tagging** — tags with the version from `package.json` + `latest`
- 🎯 **Custom tags** — pass an extra tag as a positional argument
- 🚀 **Multi-platform** — builds `linux/amd64` and `linux/arm64` via `docker buildx`
- 🔍 **Dry run** — preview the tags without building/pushing

### Usage

```bash
# Full build with quality checks
npm run docker:build-push

# Dry run — show what would happen without building/pushing
npm run docker:dry-run

# Direct script usage (e.g. with a custom tag)
./scripts/docker-build-push.sh beta
./scripts/docker-build-push.sh --help
```

### Requirements

- Docker installed and running, with `buildx`
- ghcr.io authentication (`docker login ghcr.io`) — the script prompts if needed;
  use a GitHub personal access token with the `write:packages` scope as the password
- Node.js + npm
- Run from the repository root

### Tags pushed

- `ghcr.io/andrewshell/fedwikifeeds:<version>` (from `package.json`)
- `ghcr.io/andrewshell/fedwikifeeds:latest`
- `ghcr.io/andrewshell/fedwikifeeds:<custom-tag>` (if provided)

### Running the published image

fedwikifeeds keeps its feed/roster cache, `blacklist.json`, and `cname.json`
on disk under `/app/data`, so mount a volume there to persist them across
restarts. Set `DOC_ROOT` to the externally-reachable URL so generated
feeds/pages link back correctly. See the root [README.md](../README.md) for
the format of `blacklist.json`/`cname.json`.

```bash
docker run -d -p 3000:3000 \
  -e DOC_ROOT=https://fedwikiriver.com \
  -v fedwikifeeds-data:/app/data \
  ghcr.io/andrewshell/fedwikifeeds:latest
```

See `examples/dockge/compose.yaml` for a ready-to-paste stack for
[Dockge](https://github.com/louislam/dockge).

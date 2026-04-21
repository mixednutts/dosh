# Dosh
<div style="border:1px solid #555; border-radius:6px; padding:8px 12px; display:inline-block; line-height:1.15;">
<sub><sup><b>dosh</b> | \ˈdɒʃ\ (rhymes with posh or wash)</sup></sub><br>
<sub>noun <i>informal</i> <code>chiefly British & Australian</code></sub><br>
<sub>A slang term for money, typically referring to physical cash one has available
for immediate spending. Often used in Australia to denote the necessary funds for a purchase
or a "fair whack" of currency.</sub><br>
<sub><i>"It's a cracking ute, mate, but it'll cost you a serious bit of <b>dosh</b>."</i></sub>
</div>



[![Version](https://img.shields.io/github/v/release/mixednutts/dosh?include_prereleases&label=version)](https://github.com/mixednutts/dosh/releases)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-blue?logo=docker)](https://github.com/mixednutts/dosh/pkgs/container/dosh)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Dosh** is a workflow-driven personal finance application designed for people who want intentional control over their money without the complexity of traditional accounting software.

## What is Dosh?

Dosh helps you manage your finances through a structured budget cycle approach:

- **Guided Budget Setup** — Define income sources, expense categories, savings goals, and investment plans
- **Budget Cycle Planning** — Create and manage budget cycles with clear start/end dates
- **Transaction-Backed Tracking** — Record actual income, expenses, and transfers with full ledger transparency
- **Close-Out Workflows** — Complete budget cycles with carry-forward surplus handling and historical snapshots
- **Budget Health Insights** — Get supportive, explainable assessments of your budget's setup and execution health
- **Regional Formatting** — Automatic locale-aware date, currency, and number formatting

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Deployment

1. Create a `docker-compose.yml` file:

```yaml
services:
  dosh:
    image: ghcr.io/mixednutts/dosh:latest
    container_name: dosh
    restart: unless-stopped
    volumes:
      - dosh-data:/app/data
    environment:
      - DATABASE_URL=sqlite:////app/data/dosh.db
      - TZ=Australia/Sydney
    ports:
      - "3080:3080"

volumes:
  dosh-data:
```

2. Start the application:

```bash
docker compose up -d
```

3. Access Dosh at `http://localhost:3080`

4. Create your first budget and start tracking!

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `sqlite:////app/data/dosh.db` |
| `TZ` | Timezone for budget cycle boundaries | `Australia/Sydney` |
| `GITHUB_RELEASES_TOKEN` | GitHub token for release notes (optional) | — |

### Persistent Storage

Dosh stores all data in a SQLite database within the Docker volume `dosh-data`. To backup your data:

```bash
docker exec dosh sh -c "cat /app/data/dosh.db" > dosh-backup-$(date +%Y%m%d).db
```

To restore from backup:

```bash
docker cp dosh-backup-YYYYMMDD.db dosh:/app/data/dosh.db
docker restart dosh
```

## Documentation

For detailed documentation, development guides, and architecture decisions:

- **[User Guide & Features](docs/)** — Complete documentation for using Dosh
- **[Development Setup](docs/DEVELOPMENT_ACTIVITIES.md)** — Contributing and development workflows
- **[Release Notes](docs/RELEASE_NOTES.md)** — Version history and changelog
- **[Architecture & Plans](docs/plans/)** — Design documents and feature specifications

## Tech Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy, SQLite
- **Frontend:** React 18, Vite, React Query, React Router
- **Testing:** pytest, Jest, React Testing Library, Playwright
- **Deployment:** Docker, Docker Compose, GitHub Container Registry

## License

[MIT License](LICENSE)

## Support

For issues, feature requests, or contributions, please visit the [GitHub repository](https://github.com/mixednutts/dosh).

---

**Note:** Dosh is currently in beta. While fully functional for personal finance management, APIs and features may evolve as the project matures.

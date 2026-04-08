# VersionReleaseGraph

An internal React dashboard that visualises, per client, the progressive promotion of versioned builds across deployment environments (`dev → qa → preprod → prod`). It calls the Azure DevOps REST API directly from the browser and renders a linear promotion graph using React Flow.

---

## Running without Azure credentials (mock data)

The app ships with built-in mock data so you can run it locally without any Azure DevOps access.

`.env.local` already has `VITE_USE_MOCK_DATA=true` set by default. Just install and start:

```bash
npm install
npm run dev
```

Mock data lives in `src/lib/mockData.ts` and covers both pre-configured clients (Client A / Client B) with realistic multi-environment promotion scenarios, `risk:db` / `risk:env` tags, and edge cases (invalid semver, missing env tag).

To switch to real Azure DevOps data, set `VITE_USE_MOCK_DATA=false` in `.env.local` and fill in the other variables (see [Configure environment variables](#2-configure-environment-variables) below).

---

## Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- An **Azure DevOps Personal Access Token (PAT)** scoped to **Build (Read)** *(only needed when not using mock data)*

---

## Quick Start

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd VersionReleaseGraph
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root (this file is git-ignored and must never be committed):

```
VITE_AZURE_DEVOPS_PAT=<your-personal-access-token>
VITE_AZURE_DEVOPS_ORG=<your-organisation-name>
VITE_AZURE_DEVOPS_PROJECT=<your-project-name>
```

| Variable | Description |
|---|---|
| `VITE_AZURE_DEVOPS_PAT` | PAT with **Build (Read)** scope only |
| `VITE_AZURE_DEVOPS_ORG` | Azure DevOps organisation name (e.g. `mycompany`) |
| `VITE_AZURE_DEVOPS_PROJECT` | Azure DevOps project name (e.g. `MyProject`) |

The PAT is Base64-encoded at runtime and sent as `Authorization: Basic <base64(:<PAT>)>`. It is never hardcoded in source.

> **Security note:** Because there is no backend, the PAT is visible to any user who opens DevTools. Deploy this tool only on private/internal networks and scope the PAT to **Build (Read)** only.

### 3. Configure clients

Edit `src/config/clients.ts` to list your clients and their Azure DevOps pipeline definition IDs:

```typescript
export const clients: Client[] = [
  {
    id: "client-a",
    name: "Client A",
    azurePipelineIds: [101],       // pipeline definition ID from Azure DevOps
  },
  {
    id: "client-b",
    name: "Client B",
    azurePipelineIds: [102, 103],  // multiple pipelines are merged
  },
]
```

Pipeline definition IDs can be found in the Azure DevOps UI under **Pipelines → Edit** — the `definitionId` is in the URL.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Build for Production

```bash
npm run build
```

The static output is written to `dist/`. Deploy it to any static hosting service (Azure Static Web Apps, GitHub Pages, Nginx, etc.).

Make sure the environment variables are set in the hosting platform or baked in at deploy time — they are not read at runtime by the static files.

### Preview the production build locally

```bash
npm run preview
```

---

## How It Works

### Azure DevOps tag conventions

The app relies entirely on tags applied to Azure DevOps builds:

| Tag | Meaning |
|---|---|
| `env:dev` | Build was deployed to **dev** |
| `env:qa` | Build was deployed to **qa** |
| `env:preprod` | Build was deployed to **preprod** |
| `env:prod` | Build was deployed to **prod** |
| `risk:db` | This build includes database schema changes |
| `risk:env` | This build changes environment variables |

Builds without a valid `env:*` tag or a parseable semver `buildNumber` are silently skipped (a warning is logged to the browser console).

### Graph logic

Each version appears **once** in the graph at its **highest reached environment**:

```
version 1.0.0 promoted to dev, qa, prod  →  shown as prod  (green)
version 1.1.0 promoted to dev, qa        →  shown as qa    (blue)
version 1.2.0 promoted to dev only       →  shown as dev   (gray)
```

Nodes are sorted by semver ascending (oldest at top, newest at bottom). Click any node to open a detail panel showing all environments that version reached.

---

## Project Structure

```
src/
├── main.tsx                   Entry point
├── App.tsx                    Router setup
├── config/
│   └── clients.ts             Static list of clients + pipeline IDs
├── lib/
│   ├── types.ts               Shared TypeScript types
│   ├── azureDevOps.ts         Azure DevOps REST API calls (bypassed when VITE_USE_MOCK_DATA=true)
│   ├── mockData.ts            Built-in mock builds for local development
│   └── transformBuilds.ts     Core promotion logic
├── hooks/
│   └── useBuilds.ts           Data-fetching hook (60 s in-memory cache)
├── pages/
│   ├── HomePage.tsx           Client tile grid
│   └── ClientPage.tsx         Promotion graph view
└── components/
    ├── ClientTile.tsx          Clickable client card
    ├── PromotionGraph.tsx      React Flow wrapper
    ├── VersionNode.tsx         Custom graph node
    └── BuildDetailsPanel.tsx  Slide-in detail panel
```

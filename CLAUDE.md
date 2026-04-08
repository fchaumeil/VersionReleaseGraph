# VersionReleaseGraph — Claude Code Instructions

## Project Overview

A React-based internal tool that visualizes, per client, the progressive promotion of versioned builds across deployment environments (dev, qa, preprod, prod). It connects to Azure DevOps via a secure backend proxy and renders a linear promotion graph using React Flow.

---

## Architecture

```
browser (React + React Flow)
        │
        ▼
  Express / Node backend   ←── PAT stored here only
        │
        ▼
  Azure DevOps REST API
```

### Frontend
- **Vite + React + TypeScript**
- **React Router** — routes: `/` (home), `/client/:id`
- **React Flow** — graph rendering
- **semver** — version sorting and validation

### Backend
- **Node / Express** (or Azure Functions for deployment)
- Proxies all Azure DevOps calls; the PAT never reaches the browser
- Light in-memory cache (30–60 s) per client

---

## Environment Variables

### Backend (never expose to frontend)
```
AZURE_DEVOPS_PAT=<personal-access-token-with-read-access-to-builds>
AZURE_DEVOPS_ORG=<organisation-name>
AZURE_DEVOPS_PROJECT=<project-name>
PORT=3001
```

### Frontend (Vite)
```
VITE_API_BASE_URL=http://localhost:3001
```

No credentials belong in the frontend environment.

---

## Directory Structure

```
/
├── CLAUDE.md
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express entry point
│   │   ├── routes/
│   │   │   ├── clients.ts    # GET /api/clients
│   │   │   └── builds.ts     # GET /api/builds?clientId=xxx
│   │   ├── services/
│   │   │   └── azure.ts      # Azure DevOps API calls
│   │   └── cache.ts          # Simple TTL cache
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── pages/
    │   │   ├── HomePage.tsx         # Client tile grid
    │   │   └── ClientPage.tsx       # Promotion graph view
    │   ├── components/
    │   │   ├── ClientTile.tsx
    │   │   ├── PromotionGraph.tsx   # React Flow wrapper
    │   │   ├── VersionNode.tsx      # Custom React Flow node
    │   │   └── BuildDetailsPanel.tsx
    │   ├── hooks/
    │   │   └── useBuilds.ts
    │   ├── lib/
    │   │   ├── transformBuilds.ts   # Core promotion logic
    │   │   └── types.ts
    │   └── config/
    │       └── clients.ts           # Static client list
    ├── package.json
    ├── vite.config.ts
    └── tsconfig.json
```

---

## Core Data Types (`frontend/src/lib/types.ts`)

```typescript
export type Environment = "dev" | "qa" | "preprod" | "prod"

export const ENV_PRIORITY: Record<Environment, number> = {
  dev: 1,
  qa: 2,
  preprod: 3,
  prod: 4,
}

export type Build = {
  id: string
  version: string          // semver extracted from build number
  environment: Environment
  timestamp: string        // ISO 8601
  buildUrl: string
  commitSha: string
  tags: string[]           // raw tags from Azure DevOps
  hasDbChanges: boolean    // derived from tag "risk:db"
  hasEnvChanges: boolean   // derived from tag "risk:env"
}

export type VersionNode = {
  version: string
  highestEnv: Environment
  build: Build             // the build that reached highestEnv
  allBuilds: Build[]       // all builds for this version (for detail panel)
}

export type Client = {
  id: string
  name: string
  azurePipelineIds: number[]  // which Azure pipeline definitions to query
}
```

---

## Promotion Logic (`frontend/src/lib/transformBuilds.ts`)

This is the critical transformation that converts raw Azure build data into the visual graph input.

### Algorithm

1. **Parse** each build's `buildNumber` with `semver.valid()` — skip and log any that fail.
2. **Extract environment** from tags matching the pattern `env:<name>` (e.g. `env:qa`).
3. **Extract risk flags** from tags `risk:db` → `hasDbChanges`, `risk:env` → `hasEnvChanges`.
4. **Group** builds by version: `Map<string, Build[]>`.
5. **Select highest environment** per version using `ENV_PRIORITY`.
6. **Sort** the resulting `VersionNode[]` ascending by semver.
7. **Return** the sorted array — this is the direct input to the graph renderer.

### Core Rule (CRITICAL)

Each version appears **once** in the graph, at its **highest** reached environment.

```
version 1.2.0 exists in dev, qa, prod → displayed as prod
version 1.3.0 exists in dev, qa      → displayed as qa
version 1.4.0 exists in dev only     → displayed as dev
```

### Example transformation

Raw builds:
```
1.0.0 dev, 1.0.0 qa, 1.0.0 prod
1.1.0 dev, 1.1.0 qa
1.2.0 dev
1.3.0 dev
```

Output graph (top = highest/oldest, bottom = lowest/newest):
```
[1.0.0]  prod   ← green
   |
[1.1.0]  qa     ← blue
   |
[1.2.0]  dev    ← gray
   |
[1.3.0]  dev    ← gray
```

---

## Backend API

### `GET /api/clients`
Returns the static client list (sourced from `clients.ts` config on the backend).

```json
[
  { "id": "client-a", "name": "Client A", "azurePipelineIds": [42] }
]
```

### `GET /api/builds?clientId=<id>`
1. Look up the client's `azurePipelineIds`.
2. For each pipeline, call Azure DevOps:
   ```
   GET https://dev.azure.com/{org}/{project}/_apis/build/builds
     ?definitions={pipelineId}
     &$top=200
     &api-version=7.1
   ```
   Auth: `Basic base64(:<PAT>)`
3. Map each Azure build to the internal `Build` type.
4. Return the array; transformation happens on the frontend.

Cache responses with a TTL of 60 seconds keyed by `clientId`.

---

## Azure DevOps Build Field Mapping

| Internal field  | Azure DevOps field                        |
|-----------------|-------------------------------------------|
| `id`            | `build.id.toString()`                     |
| `version`       | `semver.valid(build.buildNumber)`         |
| `environment`   | tag matching `/^env:(dev|qa|preprod|prod)/` |
| `timestamp`     | `build.finishTime` (ISO string)           |
| `buildUrl`      | `build._links.web.href`                   |
| `commitSha`     | `build.sourceVersion` (first 7 chars)     |
| `tags`          | `build.tags` (string[])                   |
| `hasDbChanges`  | `build.tags.includes("risk:db")`          |
| `hasEnvChanges` | `build.tags.includes("risk:env")`         |

Builds without a valid `env:*` tag or without a parseable semver `buildNumber` are silently skipped with a `console.warn`.

---

## UI Behaviour

### Home page (`/`)
- Responsive grid of `<ClientTile>` cards.
- Each tile shows the client name.
- Click navigates to `/client/:id`.

### Client page (`/client/:id`)
- Fetches builds via `useBuilds(clientId)`.
- Transforms raw builds → `VersionNode[]`.
- Passes nodes to `<PromotionGraph>`.
- Shows loading spinner while fetching; shows error message on failure.
- Empty state: "No builds found for this client."

### Promotion graph

Rendered with **React Flow** in a vertical, top-to-bottom layout.

- Each `VersionNode` becomes a custom React Flow node (`VersionNode` component).
- Nodes are connected top-to-bottom with a simple straight edge.
- Graph is centered; scrollable for long histories.

#### VersionNode component displays:
- Version string (bold, large)
- Environment badge (color-coded)
- Timestamp (human-readable, e.g. "2024-03-15 14:32")
- Warning icons when `hasDbChanges` or `hasEnvChanges` is true
- Clickable — opens `<BuildDetailsPanel>` as a side panel

#### Environment badge colors:
| Environment | Color  |
|-------------|--------|
| dev         | gray   |
| qa          | blue   |
| preprod     | purple |
| prod        | green  |

#### Warning indicators on the node:
- `risk:db` tag → database icon / "DB changes" label in orange
- `risk:env` tag → settings icon / "Env vars changed" label in orange

### Build details panel
Opens as a slide-in side panel when a node is clicked.

Displays:
- Version
- Highest environment reached
- Build timestamp
- Commit SHA (shortened, copyable)
- "Open in Azure DevOps" external link button
- All raw tags
- DB changes warning (if applicable)
- Env var changes warning (if applicable)
- Table of all environments this version reached (from `allBuilds`), each with its own timestamp and link

---

## Client Configuration (`frontend/src/config/clients.ts`)

```typescript
import type { Client } from "../lib/types"

export const clients: Client[] = [
  {
    id: "client-a",
    name: "Client A",
    azurePipelineIds: [101],
  },
  {
    id: "client-b",
    name: "Client B",
    azurePipelineIds: [102, 103],
  },
]
```

Add new clients here. Pipeline IDs come from Azure DevOps pipeline definition IDs.

---

## Epics & Delivery Plan

### EPIC 1 — Project Foundation
- [ ] 1.1 Vite + React + TypeScript frontend scaffold
- [ ] 1.2 Express backend with `/api/clients` and `/api/builds` routes
- [ ] 1.3 PAT stored only in backend `.env`; frontend never sees it
- [ ] 1.4 Azure DevOps build fetch wired end-to-end

### EPIC 2 — Data Modeling & Transformation
- [ ] 2.1 Define types in `types.ts`
- [ ] 2.2 Parse semver from `buildNumber`
- [ ] 2.3 Extract environment from `env:*` tags
- [ ] 2.4 Extract risk flags from `risk:db` / `risk:env` tags
- [ ] 2.5 Group builds by version
- [ ] 2.6 Select highest environment per version
- [ ] 2.7 Sort by semver ascending
- [ ] 2.8 Unit tests for all transformation scenarios (see EPIC 8)

### EPIC 3 — Home Page
- [ ] 3.1 Client config file
- [ ] 3.2 Tile grid with navigation

### EPIC 4 — Promotion Graph UI
- [ ] 4.1 React Flow container, vertical layout
- [ ] 4.2 Custom `VersionNode` component
- [ ] 4.3 Environment badge colors
- [ ] 4.4 DB / env-var warning indicators on nodes
- [ ] 4.5 Straight edges connecting nodes top-to-bottom
- [ ] 4.6 Scroll support for long histories
- [ ] 4.7 Empty state

### EPIC 5 — Build Details Panel
- [ ] 5.1 Side panel triggered by node click
- [ ] 5.2 Version, environment, timestamp, commit SHA
- [ ] 5.3 Azure DevOps external link
- [ ] 5.4 All raw tags displayed
- [ ] 5.5 Per-environment breakdown table

### EPIC 6 — Security
- [ ] 6.1 PAT never in frontend bundle or network response
- [ ] 6.2 CORS restricted to frontend origin
- [ ] 6.3 (Optional) Basic auth or IP allowlist on backend

### EPIC 7 — UX & Performance
- [ ] 7.1 Loading spinner / skeleton
- [ ] 7.2 Error boundary + user-facing error message
- [ ] 7.3 Backend cache (60 s TTL)

### EPIC 8 — Validation
- [ ] 8.1 Version only in dev → node shows dev
- [ ] 8.2 Version in dev + qa → node shows qa
- [ ] 8.3 Version in all environments → node shows prod
- [ ] 8.4 Version with gaps (dev, prod, no qa/preprod) → node shows prod
- [ ] 8.5 Invalid semver build number → skipped, warned in console
- [ ] 8.6 Build with no `env:*` tag → skipped, warned in console
- [ ] 8.7 Cross-check graph output against Azure DevOps UI

### EPIC 9 — Deployment
- [ ] 9.1 Backend deployed (Azure Functions or App Service)
- [ ] 9.2 Frontend deployed (Static Web Apps or equivalent)
- [ ] 9.3 Environment variables configured in hosting platform

---

## Key Constraints & Non-Goals

- **Semver only**: build numbers that are not valid semver are ignored.
- **Tag-driven**: environment detection is entirely tag-based (`env:<name>`). No heuristics from pipeline names.
- **One node per version**: the graph never shows the same version twice.
- **No write operations**: this is a read-only dashboard; it never triggers builds.
- **No auth in MVP**: basic access control is optional for the first release.

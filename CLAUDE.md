# VersionReleaseGraph — Claude Code Instructions

## Project Overview

A React-based internal tool that visualizes, per client, the progressive promotion of versioned builds across deployment environments (dev, qa, preprod, prod). It calls the Azure DevOps REST API directly from the browser and renders a linear promotion graph using React Flow.

---

## Architecture

```
browser (React + React Flow)
        │
        ▼ fetch + Basic auth (PAT from env var)
  Azure DevOps REST API
```

No backend. The app is a pure static site.

> **Security note:** The PAT is visible to any user who opens DevTools. This is an accepted tradeoff for an internal tool deployed on a private/corporate network. Scope the PAT to **Build (Read)** only on the relevant project to minimise blast radius.

---

## Tech Stack

- **Vite + React + TypeScript**
- **React Router** — routes: `/` (home), `/client/:id`
- **React Flow** — graph rendering
- **semver** — version sorting and validation

---

## Environment Variables (Vite)

Stored in `.env.local` (git-ignored):

```
VITE_AZURE_DEVOPS_PAT=<personal-access-token-scope:Build-Read>
VITE_AZURE_DEVOPS_ORG=<organisation-name>
VITE_AZURE_DEVOPS_PROJECT=<project-name>
```

The PAT is Base64-encoded at runtime and passed as `Authorization: Basic <base64(:<PAT>)>` on every Azure DevOps request. It is **never** hardcoded in source.

`.env.local` must be listed in `.gitignore`. Never commit it.

---

## Directory Structure

```
/
├── CLAUDE.md
├── .env.local          # git-ignored, holds PAT + org/project
├── .gitignore
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── pages/
    │   ├── HomePage.tsx         # Client tile grid
    │   └── ClientPage.tsx       # Promotion graph view
    ├── components/
    │   ├── ClientTile.tsx
    │   ├── PromotionGraph.tsx   # React Flow wrapper
    │   ├── VersionNode.tsx      # Custom React Flow node
    │   └── BuildDetailsPanel.tsx
    ├── hooks/
    │   └── useBuilds.ts         # Fetches + transforms builds
    ├── lib/
    │   ├── azureDevOps.ts       # Azure DevOps REST calls
    │   ├── transformBuilds.ts   # Core promotion logic
    │   └── types.ts
    └── config/
        └── clients.ts           # Static client list
```

---

## Azure DevOps API Calls (`src/lib/azureDevOps.ts`)

All calls are made directly from the browser.

### Auth helper

```typescript
function authHeader(): string {
  const pat = import.meta.env.VITE_AZURE_DEVOPS_PAT
  return "Basic " + btoa(":" + pat)
}
```

### Fetch builds for a pipeline

```
GET https://dev.azure.com/{org}/{project}/_apis/build/builds
  ?definitions={pipelineId}
  &$top=200
  &api-version=7.1
Headers:
  Authorization: Basic <base64(:<PAT>)>
```

### Fetch tags for a build

Azure DevOps does not always return tags in the builds list response. If tags are missing, fetch them separately:

```
GET https://dev.azure.com/{org}/{project}/_apis/build/builds/{buildId}/tags
  ?api-version=7.1
```

Fetch all pipelines for a client in parallel (`Promise.all`), then merge the results before transforming.

---

## Core Data Types (`src/lib/types.ts`)

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

## Promotion Logic (`src/lib/transformBuilds.ts`)

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

Output graph (top = oldest/highest-promoted, bottom = newest/lowest):
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

## Azure DevOps Build Field Mapping

| Internal field  | Azure DevOps field                          |
|-----------------|---------------------------------------------|
| `id`            | `build.id.toString()`                       |
| `version`       | `semver.valid(build.buildNumber)`           |
| `environment`   | tag matching `/^env:(dev\|qa\|preprod\|prod)/` |
| `timestamp`     | `build.finishTime` (ISO string)             |
| `buildUrl`      | `build._links.web.href`                     |
| `commitSha`     | `build.sourceVersion` (first 7 chars)       |
| `tags`          | `build.tags` (string[])                     |
| `hasDbChanges`  | `build.tags.includes("risk:db")`            |
| `hasEnvChanges` | `build.tags.includes("risk:env")`           |

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

## Client Configuration (`src/config/clients.ts`)

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
- [x] 1.1 Vite + React + TypeScript scaffold
- [x] 1.2 React Router with `/` and `/client/:id` routes
- [x] 1.3 `.env.local` wired to Vite; `.gitignore` entry confirmed
- [x] 1.4 `azureDevOps.ts` — auth helper + build fetch end-to-end

### EPIC 2 — Data Modeling & Transformation
- [x] 2.1 Define types in `types.ts`
- [x] 2.2 Parse semver from `buildNumber`
- [x] 2.3 Extract environment from `env:*` tags
- [x] 2.4 Extract risk flags from `risk:db` / `risk:env` tags
- [x] 2.5 Group builds by version
- [x] 2.6 Select highest environment per version
- [x] 2.7 Sort by semver ascending
- [x] 2.8 Unit tests for all transformation scenarios (see EPIC 8)

### EPIC 3 — Home Page
- [x] 3.1 Client config file
- [x] 3.2 Tile grid with navigation

### EPIC 4 — Promotion Graph UI
- [x] 4.1 React Flow container, vertical layout
- [x] 4.2 Custom `VersionNode` component
- [x] 4.3 Environment badge colors
- [x] 4.4 DB / env-var warning indicators on nodes
- [x] 4.5 Straight edges connecting nodes top-to-bottom
- [x] 4.6 Scroll support for long histories
- [x] 4.7 Empty state

### EPIC 5 — Build Details Panel
- [x] 5.1 Side panel triggered by node click
- [x] 5.2 Version, environment, timestamp, commit SHA
- [x] 5.3 Azure DevOps external link
- [x] 5.4 All raw tags displayed
- [x] 5.5 Per-environment breakdown table

### EPIC 6 — UX & Performance
- [ ] 6.1 Loading spinner / skeleton
- [ ] 6.2 Error boundary + user-facing error message
- [x] 6.3 In-memory cache in `useBuilds` (60 s TTL via `useRef` + timestamp)

### EPIC 7 — Validation
- [x] 7.1 Version only in dev → node shows dev
- [x] 7.2 Version in dev + qa → node shows qa
- [x] 7.3 Version in all environments → node shows prod
- [x] 7.4 Version with gaps (dev, prod, no qa/preprod) → node shows prod
- [x] 7.5 Invalid semver build number → skipped, warned in console
- [x] 7.6 Build with no `env:*` tag → skipped, warned in console
- [ ] 7.7 Cross-check graph output against Azure DevOps UI

### EPIC 8 — Deployment
- [ ] 8.1 Build static output (`vite build`)
- [ ] 8.2 Deploy to static hosting (Azure Static Web Apps, GitHub Pages, etc.)
- [ ] 8.3 Set env vars in hosting platform (or bake into build at deploy time)

---

## Key Constraints & Non-Goals

- **No backend**: pure static React app; all API calls go directly from the browser to Azure DevOps.
- **PAT security**: scope to `Build (Read)` only; deploy only on private/internal networks.
- **Semver only**: build numbers that are not valid semver are ignored.
- **Tag-driven**: environment detection is entirely tag-based (`env:<name>`). No heuristics from pipeline names.
- **One node per version**: the graph never shows the same version twice.
- **No write operations**: this is a read-only dashboard; it never triggers builds.

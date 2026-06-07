import { MOCK_PIPELINE_MAP } from "./mockData"

const PAT = import.meta.env.VITE_AZURE_DEVOPS_PAT as string | undefined
const PLACEHOLDER = "your-personal-access-token-here"

// Fall back to mock data when explicitly requested, or when no real PAT is configured
const USE_MOCK =
  import.meta.env.VITE_USE_MOCK_DATA === "true" ||
  !PAT ||
  PAT === PLACEHOLDER

const ORG = import.meta.env.VITE_AZURE_DEVOPS_ORG
const PROJECT = import.meta.env.VITE_AZURE_DEVOPS_PROJECT
const BASE = `https://dev.azure.com/${ORG}/${PROJECT}/_apis`

function authHeader(): string {
  return "Basic " + btoa(":" + PAT)
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: authHeader() },
  })
  if (!res.ok) throw new Error(`Azure DevOps API error: ${res.status} ${res.statusText}`)

  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    // Azure DevOps returns an HTML login page when auth fails on some endpoints
    throw new Error(
      `Azure DevOps returned HTML instead of JSON — check that VITE_AZURE_DEVOPS_PAT, ` +
      `VITE_AZURE_DEVOPS_ORG, and VITE_AZURE_DEVOPS_PROJECT are set correctly in .env.local`
    )
  }

  return res.json() as Promise<T>
}

export interface AzureBuild {
  id: number
  buildNumber: string
  finishTime: string
  sourceVersion: string
  tags: string[]
  _links: { web: { href: string } }
}

interface AzureBuildsResponse {
  value: AzureBuild[]
}

interface AzureTagsResponse {
  value: string[]
}

export async function fetchBuildsForPipeline(pipelineId: number): Promise<AzureBuild[]> {
  if (USE_MOCK) {
    const builds = MOCK_PIPELINE_MAP[pipelineId]
    if (!builds) console.warn(`Mock: no data for pipeline ${pipelineId}`)
    return Promise.resolve(builds ?? [])
  }

  const url = `${BASE}/build/builds?definitions=${pipelineId}&$top=200&api-version=7.1`
  const data = await apiFetch<AzureBuildsResponse>(url)
  const builds = data.value

  // Fetch tags separately for builds that have none
  await Promise.all(
    builds.map(async (build) => {
      if (!build.tags || build.tags.length === 0) {
        const tagsData = await apiFetch<AzureTagsResponse>(
          `${BASE}/build/builds/${build.id}/tags?api-version=7.1`
        )
        build.tags = tagsData.value ?? []
      }
    })
  )

  return builds
}

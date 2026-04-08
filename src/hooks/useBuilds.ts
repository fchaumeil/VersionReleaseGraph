import { useEffect, useRef, useState } from "react"
import { fetchBuildsForPipeline } from "../lib/azureDevOps"
import { transformBuilds } from "../lib/transformBuilds"
import { clients } from "../config/clients"
import type { VersionNode } from "../lib/types"

interface CacheEntry {
  nodes: VersionNode[]
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000

export function useBuilds(clientId: string) {
  const [nodes, setNodes] = useState<VersionNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const cached = cache.get(clientId)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setNodes(cached.nodes)
      setLoading(false)
      return
    }

    const client = clients.find((c) => c.id === clientId)
    if (!client) {
      setError(`Unknown client: ${clientId}`)
      setLoading(false)
      return
    }

    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)

    Promise.all(client.azurePipelineIds.map((id) => fetchBuildsForPipeline(id)))
      .then((results) => {
        const allBuilds = results.flat()
        const transformed = transformBuilds(allBuilds)
        cache.set(clientId, { nodes: transformed, fetchedAt: Date.now() })
        setNodes(transformed)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message)
        }
      })
      .finally(() => setLoading(false))

    return () => abortRef.current?.abort()
  }, [clientId])

  return { nodes, loading, error }
}

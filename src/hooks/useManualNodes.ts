import { useState, useEffect, useCallback } from "react"
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "../lib/firebase"
import type { VersionNode } from "../lib/types"

const COLLECTION = "graphs"

export interface UseManualNodesResult {
  manualNodes: VersionNode[]
  addNode: (node: VersionNode) => Promise<void>
  updateNode: (version: string, updated: VersionNode) => Promise<void>
  /** true while the initial Firestore snapshot is in flight */
  syncing: boolean
}

export function useManualNodes(clientId: string): UseManualNodesResult {
  const [manualNodes, setManualNodes] = useState<VersionNode[]>([])
  const [syncing, setSyncing] = useState(!!(db && clientId))

  useEffect(() => {
    if (!db || !clientId) {
      setSyncing(false)
      return
    }

    const ref = doc(db, COLLECTION, clientId)
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setManualNodes(snap.exists() ? ((snap.data().nodes as VersionNode[]) ?? []) : [])
        setSyncing(false)
      },
      (err) => {
        console.error("[useManualNodes] Firestore read failed:", err)
        setSyncing(false)
      }
    )
    return unsubscribe
  }, [clientId])

  const persist = useCallback(
    async (next: VersionNode[], previous: VersionNode[]) => {
      if (!db || !clientId) return
      try {
        await setDoc(
          doc(db, COLLECTION, clientId),
          { nodes: next, updatedAt: serverTimestamp() },
          { merge: true }
        )
      } catch (err) {
        console.error("[useManualNodes] Firestore write failed:", err)
        setManualNodes(previous)
      }
    },
    [clientId]
  )

  const addNode = useCallback(
    async (node: VersionNode) => {
      const next = [...manualNodes, node]
      setManualNodes(next)
      await persist(next, manualNodes)
    },
    [manualNodes, persist]
  )

  const updateNode = useCallback(
    async (version: string, updated: VersionNode) => {
      const next = manualNodes.map((n) => (n.version === version ? updated : n))
      setManualNodes(next)
      await persist(next, manualNodes)
    },
    [manualNodes, persist]
  )

  return { manualNodes, addNode, updateNode, syncing }
}

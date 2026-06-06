import { useState, useEffect, useCallback } from "react"
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "../lib/firebase"
import type { VersionNode } from "../lib/types"

const COLLECTION = "graphs"

export interface UseManualNodesResult {
  manualNodes: VersionNode[]
  addNode: (node: VersionNode) => Promise<void>
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

  const addNode = useCallback(
    async (node: VersionNode) => {
      const next = [...manualNodes, node]

      // Optimistic update — UI reflects the change immediately
      setManualNodes(next)

      if (!db || !clientId) return

      try {
        await setDoc(
          doc(db, COLLECTION, clientId),
          { nodes: next, updatedAt: serverTimestamp() },
          { merge: true }
        )
      } catch (err) {
        console.error("[useManualNodes] Firestore write failed:", err)
        // Revert to pre-add state on failure
        setManualNodes(manualNodes)
      }
    },
    [clientId, manualNodes]
  )

  return { manualNodes, addNode, syncing }
}

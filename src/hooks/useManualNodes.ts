import { useState, useEffect, useCallback } from "react"
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "../lib/firebase"
import type { VersionNode } from "../lib/types"

const COLLECTION = "graphs"

export type NodePositions = Record<string, { x: number; y: number }>

export interface UseManualNodesResult {
  manualNodes: VersionNode[]
  addNode: (node: VersionNode) => Promise<void>
  updateNode: (version: string, updated: VersionNode) => Promise<void>
  positions: NodePositions
  savePositions: (positions: NodePositions) => Promise<void>
  isPersisted: boolean
  /** true while the initial Firestore snapshot is in flight */
  syncing: boolean
}

export function useManualNodes(clientId: string): UseManualNodesResult {
  const [manualNodes, setManualNodes] = useState<VersionNode[]>([])
  const [positions, setPositions] = useState<NodePositions>({})
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
        if (snap.exists()) {
          setManualNodes((snap.data().nodes as VersionNode[]) ?? [])
          setPositions((snap.data().positions as NodePositions) ?? {})
        } else {
          setManualNodes([])
          setPositions({})
        }
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

  const savePositions = useCallback(
    async (next: NodePositions) => {
      if (!db || !clientId) return
      await setDoc(
        doc(db, COLLECTION, clientId),
        { positions: next, updatedAt: serverTimestamp() },
        { merge: true }
      )
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

  return {
    manualNodes,
    addNode,
    updateNode,
    positions,
    savePositions,
    isPersisted: !!(db && clientId),
    syncing,
  }
}

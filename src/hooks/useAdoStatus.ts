import { useState, useEffect } from "react"
import { isMockMode, checkAdoConnection } from "../lib/azureDevOps"

export type AdoStatus = "mock" | "checking" | "connected" | "error"

export function useAdoStatus(): AdoStatus {
  const [status, setStatus] = useState<AdoStatus>(isMockMode ? "mock" : "checking")

  useEffect(() => {
    if (isMockMode) return
    checkAdoConnection().then((ok) => setStatus(ok ? "connected" : "error"))
  }, [])

  return status
}

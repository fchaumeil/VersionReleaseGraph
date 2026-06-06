import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getFirestore, type Firestore } from "firebase/firestore"

function createDb(): Firestore | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  if (!apiKey || !projectId) return null

  const app: FirebaseApp = getApps().length
    ? getApps()[0]
    : initializeApp({
        apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      })

  return getFirestore(app)
}

// null when env vars are absent — consumers must handle the null case
export const db: Firestore | null = createDb()

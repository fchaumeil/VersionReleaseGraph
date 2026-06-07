import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getFirestore, type Firestore } from "firebase/firestore"

function createDb(): Firestore | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID

  if (!apiKey || !projectId) {
    console.warn(
      "[firebase] Firestore not initialised — add VITE_FIREBASE_API_KEY and " +
      "VITE_FIREBASE_PROJECT_ID (plus AUTH_DOMAIN and APP_ID) to .env.local"
    )
    return null
  }

  try {
    const app: FirebaseApp = getApps().length
      ? getApps()[0]
      : initializeApp({
          apiKey,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        })

    const firestore = getFirestore(app)
    console.info("[firebase] Firestore initialised (project: %s)", projectId)
    return firestore
  } catch (err) {
    console.error("[firebase] Firestore initialisation failed:", err)
    return null
  }
}

// null when env vars are absent — consumers must handle the null case
export const db: Firestore | null = createDb()

/** True when the four VITE_FIREBASE_* vars are present and Firebase initialised */
export const isFirestoreConfigured: boolean = db !== null

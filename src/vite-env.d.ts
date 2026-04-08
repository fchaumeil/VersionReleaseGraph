/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK_DATA: string
  readonly VITE_AZURE_DEVOPS_PAT: string
  readonly VITE_AZURE_DEVOPS_ORG: string
  readonly VITE_AZURE_DEVOPS_PROJECT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

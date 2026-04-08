export type Environment = "dev" | "qa" | "preprod" | "prod"

export const ENV_PRIORITY: Record<Environment, number> = {
  dev: 1,
  qa: 2,
  preprod: 3,
  prod: 4,
}

export type Build = {
  id: string
  version: string
  environment: Environment
  timestamp: string
  buildUrl: string
  commitSha: string
  tags: string[]
  hasDbChanges: boolean
  hasEnvChanges: boolean
}

export type VersionNode = {
  version: string
  highestEnv: Environment
  build: Build
  allBuilds: Build[]
}

export type Client = {
  id: string
  name: string
  azurePipelineIds: number[]
}

import type { Client } from "../lib/types"

export const clients: Client[] = [
  {
    id: "client-a",
    name: "Client A",
    azurePipelineIds: [101],
  },
  {
    id: "client-b",
    name: "Client B",
    azurePipelineIds: [102, 103],
  },
]

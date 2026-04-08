import type { AzureBuild } from "./azureDevOps"

const BASE_URL = "https://dev.azure.com/mock-org/mock-project/_build/results?buildId="

function build(
  id: number,
  buildNumber: string,
  tags: string[],
  finishTime: string,
  sourceVersion: string
): AzureBuild {
  return {
    id,
    buildNumber,
    finishTime,
    sourceVersion,
    tags,
    _links: { web: { href: `${BASE_URL}${id}` } },
  }
}

// client-a — pipeline 101
export const MOCK_BUILDS_101: AzureBuild[] = [
  build(1001, "1.0.0", ["env:dev"], "2024-01-10T08:00:00Z", "abc1234def5678901234567890123456789012ab"),
  build(1002, "1.0.0", ["env:qa"], "2024-01-11T09:30:00Z", "abc1234def5678901234567890123456789012ab"),
  build(1003, "1.0.0", ["env:preprod"], "2024-01-12T11:00:00Z", "abc1234def5678901234567890123456789012ab"),
  build(1004, "1.0.0", ["env:prod"], "2024-01-13T14:00:00Z", "abc1234def5678901234567890123456789012ab"),

  build(1005, "1.1.0", ["env:dev", "risk:db"], "2024-02-01T08:00:00Z", "bcd2345ef6789012345678901234567890123bc"),
  build(1006, "1.1.0", ["env:qa", "risk:db"], "2024-02-03T10:00:00Z", "bcd2345ef6789012345678901234567890123bc"),
  build(1007, "1.1.0", ["env:preprod", "risk:db"], "2024-02-05T13:00:00Z", "bcd2345ef6789012345678901234567890123bc"),

  build(1008, "1.2.0", ["env:dev", "risk:env"], "2024-03-01T08:00:00Z", "cde3456fg7890123456789012345678901234cd"),
  build(1009, "1.2.0", ["env:qa", "risk:env"], "2024-03-04T09:00:00Z", "cde3456fg7890123456789012345678901234cd"),

  build(1010, "1.3.0", ["env:dev"], "2024-04-01T08:00:00Z", "def4567gh8901234567890123456789012345de"),

  build(1011, "1.4.0", ["env:dev", "risk:db", "risk:env"], "2024-04-15T08:00:00Z", "ef5678hi9012345678901234567890123456ef"),
]

// client-b — pipeline 102
export const MOCK_BUILDS_102: AzureBuild[] = [
  build(2001, "2.0.0", ["env:dev"], "2024-01-05T08:00:00Z", "fa6789ij0123456789012345678901234567fa"),
  build(2002, "2.0.0", ["env:qa"], "2024-01-07T10:00:00Z", "fa6789ij0123456789012345678901234567fa"),
  build(2003, "2.0.0", ["env:prod"], "2024-01-10T14:00:00Z", "fa6789ij0123456789012345678901234567fa"),

  build(2004, "2.1.0", ["env:dev", "risk:db"], "2024-02-10T08:00:00Z", "gb7890jk1234567890123456789012345678gb"),
  build(2005, "2.1.0", ["env:qa", "risk:db"], "2024-02-12T11:00:00Z", "gb7890jk1234567890123456789012345678gb"),

  build(2006, "not-a-semver", ["env:dev"], "2024-02-20T08:00:00Z", "hc8901kl2345678901234567890123456789hc"),
]

// client-b — pipeline 103
export const MOCK_BUILDS_103: AzureBuild[] = [
  build(3001, "3.0.0", ["env:dev"], "2024-03-01T08:00:00Z", "id9012lm3456789012345678901234567890id"),
  build(3002, "3.0.0", ["env:qa"], "2024-03-03T09:30:00Z", "id9012lm3456789012345678901234567890id"),
  build(3003, "3.0.0", ["env:preprod"], "2024-03-05T12:00:00Z", "id9012lm3456789012345678901234567890id"),
  build(3004, "3.0.0", ["env:prod"], "2024-03-07T15:00:00Z", "id9012lm3456789012345678901234567890id"),

  build(3005, "3.1.0", ["env:dev"], "2024-04-01T08:00:00Z", "je0123mn4567890123456789012345678901je"),
  // intentionally no env:* tag — should be skipped
  build(3006, "3.1.1", [], "2024-04-02T08:00:00Z", "kf1234no5678901234567890123456789012kf"),
]

export const MOCK_PIPELINE_MAP: Record<number, AzureBuild[]> = {
  101: MOCK_BUILDS_101,
  102: MOCK_BUILDS_102,
  103: MOCK_BUILDS_103,
}

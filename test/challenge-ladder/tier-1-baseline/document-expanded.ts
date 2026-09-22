/**
 * Tier 1 — Document Expanded (5 fixtures)
 *
 * 4 existing document fixtures + 1 new (Architecture Decision Record).
 */
import type { ChallengeFixture } from "../types"
import { DOCUMENT_FIXTURES } from "../../corpora/document/fixtures"

const existingFixtures: ChallengeFixture[] = DOCUMENT_FIXTURES.map((f, idx) => ({
  id: `doc-t1-${String(idx + 1).padStart(2, "0")}`,
  tier: 1 as const,
  category: "document" as const,
  description: f.name,
  seed: 7000 + idx,
  input: {
    content: f.content,
    tool: f.tool,
    command: f.command,
  },
  expected: {
    type: "invariant" as const,
    mustContain: f.mustContain ? [...f.mustContain] : undefined,
    workflow: "swe" as const,
  },
}))

const newFixture: ChallengeFixture = {
  id: "doc-t1-05",
  tier: 1,
  category: "document",
  description: "Architecture Decision Record (ADR-005: Event-Driven Migration)",
  seed: 7100,
  input: {
    content: `# ADR-005: Migrate to Event-Driven Architecture

## Status
Accepted — 2026-09-15

## Context
Our monolithic request-response architecture is hitting scaling limits:
- P99 latency for batch operations exceeds 30s
- Database connection pool saturates at 200 concurrent users
- Synchronous webhook delivery creates cascading failures

## Decision
We will adopt an event-driven architecture using:
1. **Message Broker**: Apache Kafka (managed, 3 partitions per topic)
2. **Event Schema**: CloudEvents v1.0 with JSON encoding
3. **Consumer Groups**: One per bounded context (auth, billing, notifications)
4. **Dead Letter Queue**: Separate DLQ topic per consumer group

### Event Catalog
| Event | Source | Consumers | SLA |
|-------|--------|-----------|-----|
| user.created | auth | billing, notifications | 100ms |
| order.placed | checkout | inventory, billing, analytics | 500ms |
| payment.completed | billing | notifications, fulfillment | 200ms |
| shipment.dispatched | fulfillment | notifications, analytics | 1s |

## Consequences
### Positive
- Horizontal scaling per consumer group
- Decoupled deployment (services can evolve independently)
- Built-in retry via Kafka consumer offset management

### Negative
- Eventual consistency (no more synchronous reads after writes)
- Operational complexity (Kafka cluster management, schema registry)
- Debugging difficulty (distributed tracing required)

### Risks
- **Data loss**: Mitigated by Kafka replication factor ≥ 3
- **Message ordering**: Mitigated by partition key = entity ID
- **Schema evolution**: Mitigated by CloudEvents versioning + backward compat

## References
- [Kafka Best Practices](https://kafka.apache.org/documentation/)
- [CloudEvents Spec](https://cloudevents.io/)
- Internal RFC: "Event Mesh Proposal" (2026-08-20)`,
    tool: "read",
    command: undefined,
  },
  expected: {
    type: "invariant",
    mustContain: [
      "ADR-005",
      "Event-Driven Architecture",
      "Apache Kafka",
      "CloudEvents v1.0",
      "Dead Letter Queue",
      "user.created",
      "Eventual consistency",
    ],
    workflow: "swe",
  },
}

export const TIER1_DOCUMENT_FIXTURES: readonly ChallengeFixture[] = [
  ...existingFixtures,
  newFixture,
]

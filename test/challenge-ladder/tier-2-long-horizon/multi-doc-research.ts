/**
 * Tier 2 — Multi-Document Research Tasks (20 fixtures)
 *
 * 3–5 documents (spec, ADR, README, ticket) per fixture.
 * Task: synthesize constraints, propose plan, list risks.
 * Content includes multiple document reads concatenated.
 */
import type { ChallengeFixture, WorkflowStep } from "../types"

function ts(offset: number): string {
  return new Date(1727000000000 + offset * 1000).toISOString()
}

interface DocResearchConfig {
  title: string
  docs: { name: string; content: string }[]
  mustContainFromDocs: string[]
}

const docConfigs: DocResearchConfig[] = [
  {
    title: "Evaluate migration from REST to GraphQL",
    docs: [
      { name: "docs/api-spec.md", content: "# API Specification v2.1\n\n## Endpoints\n- GET /users — List users (paginated, max 100/page)\n- GET /users/:id — Get user by ID\n- POST /users — Create user\n- PUT /users/:id — Update user\n- DELETE /users/:id — Delete user\n- GET /users/:id/orders — List user orders\n- GET /orders/:id — Get order details\n- GET /orders/:id/items — List order items\n\n## Authentication\nBearer token (JWT), 1h expiry, refresh via /auth/refresh\n\n## Rate Limits\n100 req/min per API key, 1000 req/min premium tier" },
      { name: "docs/adr-003-graphql.md", content: "# ADR-003: Evaluate GraphQL Adoption\n\n## Status: Proposed\n\n## Context\nMobile clients make 3–5 REST calls per screen load due to nested resources (user → orders → items). This causes:\n- High latency on 3G networks\n- Wasted bandwidth (over-fetching user fields)\n- Complex client-side data assembly\n\n## Options\n1. GraphQL gateway (Apollo Server)\n2. REST with compound endpoints (/users/:id?include=orders,profile)\n3. BFF (Backend for Frontend) pattern\n\n## Constraints\n- Must maintain backward compatibility with existing REST clients\n- Max 6 months migration timeline\n- Team has no GraphQL experience" },
      { name: "JIRA-1234.md", content: "# JIRA-1234: Mobile Performance Regression\n\nReported by: Mobile Team Lead\nPriority: P1\n\n## Description\nSince v2.0 release, mobile app screen load times increased from 800ms to 2.4s.\nProfile shows 5 sequential API calls per user profile screen.\n\n## Impact\n- 23% increase in bounce rate\n- App store rating dropped from 4.5 to 4.1\n- Support tickets up 40%\n\n## Root Cause\nAPI redesign in v2.0 split compound endpoints into individual resources for 'proper REST'. This tripled the number of round trips." },
    ],
    mustContainFromDocs: ["API Specification v2.1", "GraphQL Adoption", "Mobile Performance Regression"],
  },
  {
    title: "Plan database sharding strategy for user data",
    docs: [
      { name: "docs/capacity-report.md", content: "# Database Capacity Report — Q3 2026\n\n## Current State\n- PostgreSQL 15 on r6g.4xlarge (16 vCPU, 128GB RAM)\n- Storage: 2.1 TB (growing 120 GB/month)\n- Active connections: 180 / 200 max pool\n- P99 query latency: 450ms (target: 100ms)\n- Daily WAL: 45 GB\n\n## Projections\n- At current growth, storage hits 5 TB by March 2027\n- Connection pool exhaustion expected by November 2026\n- Query latency will exceed 1s by December 2026\n\n## Users Table Stats\n- 48M rows, 680 GB\n- 85% of all queries touch this table\n- Hotspot: users in US-East (62% of traffic)" },
      { name: "docs/adr-007-sharding.md", content: "# ADR-007: Database Sharding Strategy\n\n## Status: Under Review\n\n## Options\n1. Hash-based sharding on user_id (mod N)\n2. Range-based sharding on created_at\n3. Geographic sharding (US-East, EU-West, AP-South)\n4. Citus distributed PostgreSQL extension\n\n## Criteria\n- Even data distribution\n- Cross-shard query minimization\n- Operational simplicity\n- Re-sharding capability" },
      { name: "docs/sla.md", content: "# Service Level Agreement — Data Platform\n\n- Availability: 99.95% uptime\n- Recovery Point Objective (RPO): 5 minutes\n- Recovery Time Objective (RTO): 30 minutes\n- Query latency P99: < 100ms\n- Data retention: 7 years for financial records\n- Backup frequency: Continuous WAL archival + daily snapshots" },
    ],
    mustContainFromDocs: ["Database Capacity Report", "Sharding Strategy", "99.95% uptime"],
  },
  {
    title: "Assess security vulnerabilities in authentication system",
    docs: [
      { name: "security/pentest-report.md", content: "# Penetration Test Report — Auth System\n\nDate: 2026-09-01\nTester: SecureCo Inc.\n\n## Critical Findings\n1. **JWT secret rotation** — Single static secret since 2024, no rotation mechanism\n2. **Session fixation** — Session ID not regenerated after login\n3. **Brute force** — No account lockout after failed attempts (tested 10,000 attempts)\n\n## High Findings\n4. **CORS misconfiguration** — Wildcard origin (*) with credentials\n5. **Token in URL** — Password reset token in query parameter (logged by proxies)\n\n## Medium Findings\n6. **Missing HSTS** — Strict-Transport-Security header not set\n7. **Cookie flags** — Missing Secure and SameSite=Strict" },
      { name: "docs/auth-architecture.md", content: "# Authentication Architecture\n\n## Flow\n1. User submits credentials → /auth/login\n2. Server validates against bcrypt hash (cost=10)\n3. Issues JWT (HS256, 1h expiry) + refresh token (7d)\n4. Client stores JWT in localStorage\n5. Refresh via /auth/refresh (sliding window)\n\n## Session Store\n- Redis 6.x, single node, no persistence\n- Key: session:{user_id}, TTL: 3600s" },
      { name: "compliance/gdpr-checklist.md", content: "# GDPR Compliance Checklist — Auth Module\n\n- [x] Data encryption at rest (AES-256)\n- [x] Data encryption in transit (TLS 1.3)\n- [ ] Right to erasure (account deletion flow)\n- [ ] Consent management\n- [x] Access logging\n- [ ] Data portability export\n- [ ] Breach notification procedure" },
    ],
    mustContainFromDocs: ["Penetration Test Report", "JWT secret rotation", "GDPR Compliance"],
  },
  {
    title: "Plan microservices decomposition of monolith",
    docs: [
      { name: "docs/monolith-analysis.md", content: "# Monolith Analysis Report\n\n## Code Statistics\n- Total: 487K LOC (TypeScript)\n- Modules: 12 domains (auth, billing, inventory, shipping, notifications, analytics, search, catalog, cart, checkout, reviews, support)\n- Database: Single PostgreSQL with 89 tables\n- Deployment: Single Docker container, 4GB RAM, 2 vCPU\n\n## Coupling Analysis\n- Auth ↔ Billing: 47 shared function calls\n- Inventory ↔ Shipping: 23 shared calls\n- Cart ↔ Checkout: 156 shared calls (highest coupling)\n- Reviews ↔ Support: 3 shared calls (lowest coupling)\n\n## Build Times\n- Full build: 12 minutes\n- Test suite: 45 minutes\n- Deploy: 8 minutes (rolling restart)" },
      { name: "docs/adr-010-microservices.md", content: "# ADR-010: Microservices Decomposition\n\n## Decision\nDecompose into 4 bounded contexts (phase 1):\n1. User & Auth (auth + billing)\n2. Catalog & Search (catalog + search + reviews)\n3. Order Management (cart + checkout + inventory + shipping)\n4. Engagement (notifications + analytics + support)\n\n## Criteria\n- Minimize cross-service calls\n- Align with team ownership\n- Enable independent scaling\n- Preserve data consistency" },
    ],
    mustContainFromDocs: ["Monolith Analysis Report", "Microservices Decomposition", "487K LOC"],
  },
  {
    title: "Evaluate observability stack upgrade",
    docs: [
      { name: "ops/monitoring-report.md", content: "# Observability Stack Assessment\n\n## Current Stack\n- Metrics: Prometheus 2.x (30-day retention)\n- Logs: ELK Stack (Elasticsearch 7.x, 14-day retention)\n- Traces: Jaeger (7-day retention)\n- Alerts: PagerDuty + custom Prometheus rules\n\n## Pain Points\n- Elasticsearch cluster requires 3 dedicated nodes (24 vCPU, 192GB RAM total)\n- No correlation between logs, metrics, and traces\n- Alert fatigue: 200+ alerts/week, 80% false positives\n- No SLO tracking\n\n## Monthly Cost\n- Infrastructure: $4,200/month\n- Licenses: $0 (all OSS)\n- Operational overhead: ~20 hours/month engineering time" },
      { name: "docs/proposal-opentelemetry.md", content: "# Proposal: Migrate to OpenTelemetry + Grafana Stack\n\n## Target Stack\n- OpenTelemetry Collector (unified ingestion)\n- Grafana Tempo (traces, 30-day retention)\n- Grafana Loki (logs, 30-day retention)\n- Grafana Mimir (metrics, 90-day retention)\n- Grafana OnCall (alerting with SLO)\n\n## Expected Benefits\n- Unified correlation (trace → log → metric)\n- 60% reduction in storage costs\n- SLO-based alerting (reduce false positives by 90%)\n- Single pane of glass" },
    ],
    mustContainFromDocs: ["Observability Stack Assessment", "OpenTelemetry", "200+ alerts/week"],
  },
]

export const TIER2_MULTI_DOC_FIXTURES: readonly ChallengeFixture[] = Array.from(
  { length: 20 },
  (_, idx) => {
    const cfg = docConfigs[idx % docConfigs.length]!
    const variantSuffix = idx >= docConfigs.length ? ` (extended variant ${Math.floor(idx / docConfigs.length) + 1})` : ""

    const steps: WorkflowStep[] = cfg.docs.map((doc, i) => ({
      tool: "read" as const,
      content: doc.content,
      timestamp: ts(idx * 150 + i * 10),
    }))

    const content = steps.map((s, i) =>
      `[Step ${i + 1}/${steps.length}] [${s.timestamp!}] tool=read file="${cfg.docs[i]!.name}"\n${s.content}`
    ).join("\n\n---\n\n")

    return {
      id: `doc-research-t2-${String(idx + 1).padStart(2, "0")}`,
      tier: 2 as const,
      category: "multi-doc-research" as const,
      description: `Multi-doc research: ${cfg.title}${variantSuffix}`,
      seed: 13000 + idx,
      input: {
        content,
        tool: "read" as const,
        documents: cfg.docs.map(d => d.content),
        steps,
      },
      expected: {
        type: "completion" as const,
        mustContain: cfg.mustContainFromDocs,
        workflow: "research" as const,
      },
    }
  },
)

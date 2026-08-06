# Custom Connector Pattern — Mocked External Systems

> Authoring skill: **`/uipath-connector-builder`** (Integration Service connector on disk via
> `uip is connectors builder` — `element.json`, `standard-resources/*.json`, hooks).
> Consumers: **`/uipath-api-workflow`** (calls these activities), **`/uipath-maestro-bpmn`** (service
> tasks in the case flow).
>
> **Positioning.** These connectors *move messages* — receive an alert, post a records request, read a
> provider response. They score nothing and decide nothing. **All endpoints and data are synthetic
> mocks.**

---

## Connector vs RPA — which mock gets which

The rule is simply *does the mock system expose a REST+JSON API?*

| Mock system | API? | Integration | Reason |
|---|---|---|---|
| Claims-analytics **alert source** | ✅ REST | **IS connector** (this doc) | Modern JSON endpoint → curated activity. |
| **Records-request inbox** (send request / read response) | ✅ REST | **IS connector** (this doc) | Modern JSON endpoint → curated activities. |
| Legacy Medicaid **care-management** system (Plan of Care) | ❌ none | **RPA** ([`../rpa/legacy-pulls.md`](../rpa/legacy-pulls.md)) | No API — UI-only; robot scrapes the screen. |
| Legacy **EVV vendor portal** (raw visits) | ❌ none | **RPA** ([`../rpa/legacy-pulls.md`](../rpa/legacy-pulls.md)) | No API — UI-only; robot scrapes the table. |

> **Why the legacy pair can't be a connector:** `/uipath-connector-builder` connectors wrap **REST APIs
> that return JSON only**. The care-management system and EVV portal have no API, no webhook, and no
> JSON surface — only a human login screen. There is nothing for a connector to call, so those two use
> RPA UI automation instead. A connector here would have no resources to define.

---

## Connector: `Program Integrity Mock Systems`

One design connector (`design-uipathlabs-pi360-mock`) fronting the two REST mocks. Built with the
`/uipath-connector-builder` lifecycle: `init` → `auth set` → `activity create` (+ field schema for
**every** activity, Rule 11) → `validate` → `import` → `publish`.

### Element definition shape (`app/element/element.json`)

```jsonc
{
  "name": "Program Integrity Mock Systems",
  "key": "design-uipathlabs-pi360-mock",
  "baseUrl": "https://mock-pi360.local/api/v1",
  "categories": ["Productivity"],
  "authentication": {
    "type": "customApiKey",            // header API key — simplest fit for a mock facade
    "authenticationTypes": ["customApiKey"]
  },
  "configuration": [
    { "key": "api.key", "type": "PASSWORD", "encrypt": true,        // supplied at connection time
      "configScreenType": "pre", "hintText": "Program Integrity mock API key" },
    { "key": "base.url", "defaultValue": "https://mock-pi360.local/api/v1" }
  ],
  "resources": [ /* Get Alert, Post Records Request, Get Provider Response — see below */ ]
}
```

- **Auth type:** `customApiKey` (header key), written by `auth set` — encrypted `PASSWORD` field, real
  value supplied by the end user at connection time. The connector stores only the auth *type* + base
  URL (Rule 9: never hard-code a secret).
- **Base URL:** single `https://mock-pi360.local/api/v1` config; both mock systems live behind it as
  distinct resource paths (no per-connection host templating needed for the demo).

### Activities (resources + `standard-resources/*.json`, each with a field schema)

| Activity | Method / path | Fronts | Request fields | Response fields |
|---|---|---|---|---|
| **Get Alert** | `GET /alerts/{alertId}` | alert source | `alertId` (path) | `alertId, alertDate, model, providerId, attendantId, servicePeriod{start,end}` |
| **Post Records Request** | `POST /records-requests` | records inbox | `caseId, providerId, attendantId, requestedDocs[], respondBy` | `requestId, status, sentAt` |
| **Get Provider Response** | `GET /records-requests/{requestId}/response` | records inbox | `requestId` (path) | `from, received, summary, attachments, documentUri` |

> Every activity carries a full field schema (via `--fields-file` on `activity create` or
> `activity field create`) — a fieldless activity ships as a raw-JSON passthrough and trips a `validate`
> warning (Rule 11). `Get Alert` and `Get Provider Response` are true by-id reads (`GETBYID`
> semantics); `Post Records Request` is a write-only action (no `/{id}` suffix).

---

## How it plugs into the API workflows & BPMN

The activities map one-to-one onto the outbound/inbound points of
[`../api-workflows/api-lookups.md`](../api-workflows/api-lookups.md):

| Connector activity | API workflow | Data Fabric effect |
|---|---|---|
| **Get Alert** | `IntakeAlertCreateCase` (a) — receives `ALERT-CA-2026-7781` | writes `ProgramIntegrityCase` |
| **Post Records Request** | `SendProviderRecordsRequest` (d) — Stage 6, **after investigator proceeds** | writes `InvestigationAction`, sets case `Awaiting Provider` |
| **Get Provider Response** | reprocessing on `DOC-CORR-01` arrival (received 2026-07-28) during the Stage 6 wait state | writes `EvidenceDocument` (Correspondence) |

Wiring per `/uipath-api-workflow` Rule 16: activities are pulled via `uip api-workflow registry resolve`
+ `stub` (never hand-authored); IntSvc calls need a **pinged connection UUID**; in solutions mode the
connection is synced into the catalogue (`bindings sync` → `solution resource refresh`).

In **`/uipath-maestro-bpmn`**, the alert-source connector backs the **Stage 1** intake trigger, and the
records-inbox connector backs the **Stage 6** outbound request + wait-state response intake. The claims
data-warehouse and enrollment lookups in the API-workflow doc are plain HTTP calls (public/internal REST
via the unified HTTP activity), so they need no custom connector.

> Reminder: these connectors only *carry* alerts and requests. Priority, risk signals, exposure, and any
> adverse/financial action remain with `deterministic-calc-v1` and the human approval gates — the
> connector is a transport, not a decision-maker. Synthetic data throughout.

# Deploy — Program Integrity 360

*Authored per `/uipath-solution`. The EXACT command sequence to deploy the solution to staging.*

> **Read `CANON.md` first.** Target is canonical (§11). Synthetic data only.

## ⚠️ Human-run, interactive, live tenant

**`uip login` is interactive** — it opens a **browser** for OAuth and authenticates a real human against a **live tenant**. Everything after it (`publish`, `deploy`, `activate`) **pushes to and mutates a live tenant** (`staging.uipath.com` / org `uipathlabs` / tenant `Playground`). **A human runs these commands.** Do not automate `uip login`, and do not run publish/deploy/activate unattended. This document lists the commands as **text to be run by a person**; nothing here has been executed.

## Target
- Cloud: **`staging.uipath.com`**
- Organization: **`uipathlabs`**
- Tenant: **`Playground`**
- Solution name: **`Program Integrity 360`**
- Artifact: **`Program Integrity 360.uipx`**

## 0. Prerequisites (human)
- `uip` CLI installed and on PATH (`uip --version`).
- Access to org `uipathlabs`, tenant `Playground`, with permission to publish + deploy solutions and manage Data Fabric / queues / buckets / connections / assets.
- Run all commands from the solution root: `/Users/sohail.ghatnekar/program-integrity-360`.

## 1. Login (interactive — a human does this)
```bash
# Opens a browser for OAuth against the live staging tenant.
uip login --cloud-url https://staging.uipath.com --organization uipathlabs --tenant Playground
```
Verify the session points at the right place before continuing:
```bash
uip config show          # confirm cloud-url = staging.uipath.com, org = uipathlabs, tenant = Playground
```

## 2. Initialize the solution (first time only)
```bash
# Run in the solution root. Skip if solution.json already exists (this repo ships one).
uip solution init "Program Integrity 360"
```

## 3. Restore project + resource references
```bash
uip solution restore
```
Resolves the 7 bundled projects (P1–P7) and all shared-resource references (entities, queues, buckets, connections, assets) declared in `solution.json`.

## 4. Pack
```bash
uip solution pack --output "./Program Integrity 360.uipx"
```
Produces the versioned `.uipx` (pins each project's exact version — see `project-structure.md`).

## 5. Publish to the tenant feed
```bash
uip solution publish "./Program Integrity 360.uipx"
```
Uploads the packed solution to the `Playground` tenant feed. If a name+version collision occurs, bump the solution version in `solution.json` (semver) and re-pack (step 4) before re-publishing.

## 6. Deploy
```bash
uip solution deploy --name "Program Integrity 360" --version 1.0.0
```
Creates/updates the solution instance and its shared resources in the tenant. Resolve any **unset/unresolved bindings** (connections to legacy-care-mgmt, claims-api, evv-api, records-inbox; assets `pi360.unit_rate` etc.) if prompted — every cross-project reference must bind to a `Playground` tenant object before activation.

## 7. Activate
```bash
uip solution activate --name "Program Integrity 360" --version 1.0.0
```
Turns on the deployed solution (case app, BPMN subprocesses, agents, coded app, triggers).

## 8. Post-deploy verification (human)
```bash
# a) Solution is deployed + active
uip solution list
uip solution status --name "Program Integrity 360"

# b) Data Fabric entities exist (expect the 9 from docs/03-data-model.md)
uip df entities list

# c) Shared resources are present
uip orchestrator queues list        # expect pi360-evidence-collection, pi360-records-intake
uip orchestrator buckets list       # expect pi360-evidence, pi360-referral-packets
uip orchestrator assets list        # expect pi360.unit_rate=7.20, poc.*, roles.*, autoconfirm_threshold
```
**Smoke check (matches `test/test-plan.md` E2E-01):** open the Coded App, confirm case **PI-PCS-2026-0041** loads with priority **High**, the **2026-04-14 90-minute** overlap renders, improper units total **24** ($172.80 sample), and the supervisor gate blocks an adverse action until `sup.morgan` approves. Run the compact smoke-test checklist in the test plan.

## 9. Rollback
If activation or verification fails, roll back to the previously published solution version:
```bash
# Re-deploy + re-activate the last known-good version (example: 0.9.0)
uip solution deploy   --name "Program Integrity 360" --version 0.9.0
uip solution activate --name "Program Integrity 360" --version 0.9.0
```
The prior published `.uipx` remains in the tenant feed, so rollback is a re-deploy of that version — no re-pack needed. If a fresh deploy must be removed entirely, deactivate/undeploy the failed version, then investigate binding/resource errors before retrying step 6.

> Command flags follow the `uip solution` lifecycle (`init` → `restore` → `pack` → `publish` → `deploy` → `activate`). Confirm exact flag names against your installed `uip --help` before running, since the CLI evolves. Nothing in this file has been executed.

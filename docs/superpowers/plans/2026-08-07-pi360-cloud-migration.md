# Program Integrity 360 Cloud Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the complete working Program Integrity 360 demo from staging to production Automation Cloud in `uipathlabs / Playground / AMER Presales/Public Sector/ProgramIntegrity360`.

**Architecture:** Promote the immutable tested solution package, recreate the tenant-level Data Fabric layer from canonical fixtures, and deploy the coded web app independently with destination-specific OAuth and folder identities. Preserve staging and verify every mutation through the UiPath CLI.

**Tech Stack:** UiPath CLI `1.198.x`, UiPath Solutions, Data Fabric, Maestro, Coded Apps, React 19, TypeScript, Vite, Vitest, Node.js.

## Global Constraints

- Do not modify, deactivate, or delete the staging deployment.
- Use `https://cloud.uipath.com`, organization `uipathlabs`, tenant `Playground`.
- Deploy under parent folder `AMER Presales/Public Sector` with key `7ea9add1-8aa5-4829-8939-0964c751b123`.
- Use solution child folder name `ProgramIntegrity360`.
- Use OAuth authorization-code with PKCE and client ID `57201488-1566-4f9b-a696-1b3773c2af33`; never request a client secret.
- Request exactly the 18 scopes supplied in the approved design.
- Keep Data Fabric at tenant scope and obtain explicit approval after showing the exact schema preview.
- Preserve user-owned untracked files.
- Run `npm test` after modifying JavaScript files.

---

### Task 1: Freeze Baseline and Prepare Destination Configuration

**Files:**
- Modify: `ProgramIntegrity360/PI360CodedApp/uipath.json`
- Create: `platform/cloud-playground-migration.json`

**Interfaces:**
- Consumes: destination OAuth contract and existing `ProgramIntegrity360_0.5.1.zip`
- Produces: validated destination settings and immutable package checksum

- [ ] **Step 1: Verify branch, auth, and CLI surfaces**

Run:

```bash
git status --short --branch
uip login status --output json
uip solution init --help --output json
uip tools list --output json
```

Expected: migration branch active; login reports `cloud.uipath.com / uipathlabs / Playground`; solution CLI responds; required tools are installed.

- [ ] **Step 2: Verify the source artifact**

Run:

```bash
shasum -a 256 ProgramIntegrity360/.solution-packages/ProgramIntegrity360_0.5.1.zip
unzip -p ProgramIntegrity360/.solution-packages/ProgramIntegrity360_0.5.1.zip package.metadata.json
```

Expected checksum: `067a287fa2a3ca93b79efe2eb82b5c19e41b4d11ecabaea262b3098ee5b1aada`; metadata name `ProgramIntegrity360`, version `0.5.1`.

- [ ] **Step 3: Replace staging OAuth settings**

Set `clientId`, `baseUrl`, `scope`, `orgName`, `tenantName`, and local `redirectUri` in `ProgramIntegrity360/PI360CodedApp/uipath.json`. Keep the folder fields temporarily unchanged until Task 2 returns destination folder identities.

- [ ] **Step 4: Run focused configuration tests**

Run:

```bash
npm test -- src/config/uipath.test.ts src/hooks/useAuth.test.tsx
```

Working directory: `ProgramIntegrity360/PI360CodedApp`.

Expected: all focused tests pass.

### Task 2: Publish and Deploy the Solution Inactive

**Files:**
- Read: `ProgramIntegrity360/.solution-packages/ProgramIntegrity360_0.5.1.zip`
- Create: `platform/cloud-playground-migration.json`

**Interfaces:**
- Consumes: verified `0.5.1` solution archive and destination parent folder key
- Produces: deployment key, solution folder GUID, folder path, and numeric folder ID

- [ ] **Step 1: Recheck package and folder collisions**

Run:

```bash
uip solution packages list --name ProgramIntegrity360 --limit 50 --output json
uip or folders list --all --name ProgramIntegrity360 --output json
```

Expected: no destination package or folder match.

- [ ] **Step 2: Publish the tested archive**

Run:

```bash
uip solution publish ProgramIntegrity360/.solution-packages/ProgramIntegrity360_0.5.1.zip --output json
```

Verify with `uip solution packages list --name ProgramIntegrity360 --limit 50 --output json` and require version `0.5.1`.

- [ ] **Step 3: Deploy without activation**

Run:

```bash
uip solution deploy run --name ProgramIntegrity360-cloud-0.5.1 --package-name ProgramIntegrity360 --package-version 0.5.1 --folder-name ProgramIntegrity360 --parent-folder-key 7ea9add1-8aa5-4829-8939-0964c751b123 --skip-activate --timeout 600 --poll-interval 5000 --output json
```

Expected: deployment succeeds and activation is skipped.

- [ ] **Step 4: Resolve destination folder identities**

Run:

```bash
uip or folders list --all --name ProgramIntegrity360 --output json
uip solution deploy list --folder-key 7ea9add1-8aa5-4829-8939-0964c751b123 --limit 100 --output json
```

Record the exact solution folder GUID, numeric folder ID, deployment key, and inactive status in `platform/cloud-playground-migration.json`.

### Task 3: Create and Seed Tenant-Level Data Fabric

**Files:**
- Modify: `platform/01_choicesets.js`
- Modify: `platform/02_entities.js`
- Modify: `platform/03_seed.js`
- Create: `platform/cloud-playground-choiceset-ids.json`
- Create: `platform/cloud-playground-entity-ids.json`

**Interfaces:**
- Consumes: approved exact schema and canonical `data/*.json` fixtures
- Produces: ten choice sets, nine entities, 52 seed records, and authoritative destination ID maps

- [ ] **Step 1: Present exact schema preview and obtain approval**

Show every choice-set value and every entity field/type/constraint defined in `platform/01_choicesets.js` and `platform/02_entities.js`. State that all objects will be tenant-level. Do not run any schema mutation until the user explicitly approves this preview.

- [ ] **Step 2: Make the migration scripts portable**

Replace hard-coded Claude scratch paths with `__dirname`-relative destination ID-map paths. Preserve the existing CLI-based create/list/insert behavior and idempotent name matching.

- [ ] **Step 3: Run the required JavaScript test gate**

Run `npm test` from `ProgramIntegrity360/PI360CodedApp` because JavaScript migration scripts changed.

Expected: all tests pass.

- [ ] **Step 4: Create and verify choice sets**

Run `node platform/01_choicesets.js`, then list destination choice sets through `uip df choice-sets list --include-folders --output json` and verify exactly ten `PI360*` sets at tenant scope.

- [ ] **Step 5: Create and verify entities**

Run `node platform/02_entities.js`, then list and get every destination entity through `uip df entities list --include-folders --native-only --output json` and `uip df entities get <id> --output json`.

Expected: exactly nine `PI360*` entities with the approved field definitions.

- [ ] **Step 6: Seed and verify records**

Run `node platform/03_seed.js`. Query each entity freshly and verify counts `1, 1, 1, 9, 12, 5, 6, 15, 2`, totaling 52.

### Task 4: Bind and Activate the Solution

**Files:**
- Modify: `ProgramIntegrity360/PI360CodedApp/uipath.json`
- Modify: `platform/cloud-playground-migration.json`

**Interfaces:**
- Consumes: destination folder identities and verified Data Fabric layer
- Produces: active solution deployment and final coded-app runtime defaults

- [ ] **Step 1: Inspect deployment resources and configuration**

Run `uip solution deploy status <deployment-key> --output json` and fetch the deployment config through the installed `uip solution deploy config` surface. Verify no resource is unset or unresolved.

- [ ] **Step 2: Activate the deployment**

Run:

```bash
uip solution deploy activate ProgramIntegrity360-cloud-0.5.1 --timeout 600 --poll-interval 5000 --output json
```

Expected: activation status `SuccessfulActivate`.

- [ ] **Step 3: Update coded-app folder defaults**

Write the exact destination `folderPath`, GUID `folderKey`, and numeric `folderId` to `ProgramIntegrity360/PI360CodedApp/uipath.json`.

- [ ] **Step 4: Upload editable solution source**

Run `uip solution upload ProgramIntegrity360 --output json` and verify every project returns an empty error list.

### Task 5: Build, Publish, and Deploy the Coded Web App

**Files:**
- Modify: `ProgramIntegrity360/PI360CodedApp/uipath.json`
- Generated: `ProgramIntegrity360/PI360CodedApp/dist/`
- Generated: `ProgramIntegrity360/PI360CodedApp/.uipath/pi360-coded-app.0.5.0.nupkg`
- Generated: `ProgramIntegrity360/PI360CodedApp/.uipath/app.config.json`

**Interfaces:**
- Consumes: public OAuth client, exact scopes, and destination folder identities
- Produces: hosted coded web app at the approved redirect URL

- [ ] **Step 1: Run full local verification**

Run from `ProgramIntegrity360/PI360CodedApp`:

```bash
npm test
npm run lint
npm run build
```

Expected: tests, lint, and production build exit zero; `dist/index.html` exists.

- [ ] **Step 2: Pack version 0.5.0**

Run `uip codedapp pack dist -n pi360-coded-app --version 0.5.0 --description "Program Integrity 360 investigator and supervisor case workbench" --author "UiPath Public Sector" --content-type webapp`.

- [ ] **Step 3: Publish and deploy non-interactively**

Run `uip codedapp publish -n pi360-coded-app --version 0.5.0 --output json`, verify `.uipath/app.config.json`, then run `uip codedapp deploy -n pi360-coded-app --folder-key <destination-folder-guid> --org-name uipathlabs --output json`.

Expected `appUrl`: `https://uipathlabs.uipath.host/pi360-coded-app`.

- [ ] **Step 4: Verify hosted OAuth metadata**

Fetch the hosted `index.html` and verify the platform-injected client ID, production API base, organization, tenant, exact scopes, and deployed redirect URI. Do not print tokens.

### Task 6: End-to-End Verification and Documentation

**Files:**
- Modify: `docs/04-demo-script.md`
- Modify: `solution/deploy.md`
- Modify: `platform/cloud-playground-migration.json`

**Interfaces:**
- Consumes: active solution, seeded data, and deployed coded app
- Produces: verified migration record and cloud demo click path

- [ ] **Step 1: Verify solution and project inventory**

Run fresh solution status, folder, package, and process listings. Confirm one solution folder, active `0.5.1`, and all 15 registered projects.

- [ ] **Step 2: Verify live app behavior**

Confirm HTTP 200, PKCE sign-in, live case discovery, task loading, the six-stage journey, Action Center links, and the `PI360RecordConversationAgent` entry point. Record any interactive checks that require the user to finish browser authentication.

- [ ] **Step 3: Update deployment documentation**

Replace staging URLs and IDs with destination values while retaining a clearly labeled staging rollback section. Keep documentation concise and do not add emojis.

- [ ] **Step 4: Run final verification**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
git status --short
```

Working directory for npm commands: `ProgramIntegrity360/PI360CodedApp`.

- [ ] **Step 5: Commit migration metadata and configuration**

Stage only migration-owned files and commit with message `chore: migrate PI360 to production cloud`.


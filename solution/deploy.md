# Deploy — Program Integrity 360 0.6.1

All data and documents are synthetic.

## Destination

- Portal: `https://cloud.uipath.com`
- Organization: `uipathlabs`
- Tenant: `Playground`
- Parent folder: `AMER Presales/Public Sector`
- Solution folder: `AMER Presales/Public Sector/ProgramIntegrity360`
- Folder key: `5db31dd1-1073-4f9e-b44b-76f5484e03c4`
- Active package: `ProgramIntegrity360` 0.6.1
- Rollback package: `ProgramIntegrity360` 0.5.1
- Upgrade pipeline deployment: `842064f8-47f1-4a76-d4d8-08def3a91432`
- Studio Web solution: `494be60c-8bb2-4478-3beb-08def46ec69f`
- Hosted coded app: `https://uipathlabs.uipath.host/pi360-coded-app`

The coded app is not republished in this pass. Its current visual design and deployment remain intact.

## Pre-deployment gates

1. Verify `uip login status --output json` targets `uipathlabs/Playground`.
2. Run the complete Python, PDF, coded-app, Case, Flow, API workflow, and agent validation suite.
3. Run `uip solution resources refresh --solution-folder ProgramIntegrity360 --output json` and inspect warnings and stderr. Remove any deployment-owned `_1` shadow resources before packaging.
4. Run a dry pack before producing the release archive.
5. Confirm the active 0.5.1 deployment and folder identifiers still match `platform/cloud-playground-migration.json`.

If an online pack re-imports deployment-owned shadow resources, do not publish that archive. Package from the clean 34-resource source tree without live resource reconciliation, then verify the archive contains no suffixed resource names or shadow IDs.

## Pack and publish

From the repository root:

```bash
uip solution pack ProgramIntegrity360 --dry-run --version 0.6.1 --output json
uip solution pack ProgramIntegrity360 ProgramIntegrity360/.solution-packages --name ProgramIntegrity360 --version 0.6.1 --output json
uip solution publish ProgramIntegrity360/.solution-packages/ProgramIntegrity360_0.6.1.zip --output json
uip solution packages list --name ProgramIntegrity360 --limit 50 --output json
```

The actual pack filename returned by the CLI is authoritative. Verify package metadata, SHA-256, and version before publication.

## Editable Studio Web source

```bash
uip solution upload ProgramIntegrity360 --output json
```

Require every per-project error list to be empty and verify the existing Studio Web solution ID. `upload` updates editable source; it does not activate an Orchestrator deployment.

## Existing-folder safety

When the deployment name and package name match an existing installation, `uip solution deploy run` upgrades that installation in place. Use the existing deployment name and parent path, confirm that the returned `InstallDeploymentKey` remains `7f49503d-481f-4a01-a625-3433f541d464`, and do not uninstall the solution folder.

The 0.6.1 upgrade returned deployment key `ef500f70-0970-4f33-bec2-58ab7f6e6050` and preserved folder key `5db31dd1-1073-4f9e-b44b-76f5484e03c4`. The server reported `SuccessfulActivate`; no parallel solution folder was created.

## Activation verification

After the in-place upgrade reports success, verify:

- Package version 0.6.1 and activation `SuccessfulActivate`.
- The exact existing solution folder key.
- Case plan, Maestro Flow, API workflow, agent, and process resources.
- Both Beeceptor routes.
- Nine PI360 Data Fabric entities and 59 total records.
- One PCS case and one hospice case by natural key.
- All nine bucket PDFs by fresh list operations.
- Service IXP live model 12 and institutional IXP live model 9.
- The hospice claim: 52 units, $3,250, place of service 12.
- The institutional record: patient class `Observation` and the exact arrival/discharge interval.

Record the package checksum, upgrade/deployment identifiers, activation state, and verification time in `platform/cloud-playground-migration.json`.

## Manual-trigger smoke tests

Run only against synthetic test records.

- PCS: `CaseType = MedicaidPCS`; claim endpoint `/MedicaidPCS`; no automatic hospital-record request.
- Hospice: `CaseType = StateMedicaidHospice`; claim endpoint `/StateMedicaidHospice`; $2,500 threshold; 72-hour provider wait when the hospital packet is unavailable; 360-minute review indicator after the packet is received.

Do not complete a real adverse or financial Action Center task.

## Data and model notes

Playground is at its 500-object Data Fabric cap. The C-light schema extends the nine existing PI360 entities and creates no new entities or choice sets. The two IXP projects are published and tagged live, but the authenticated Maestro registry does not yet expose them; the current Flow nodes remain labeled swap-ready mocks until binding is verifiable.

## Rollback

- Keep published package 0.5.1 and its recorded deployment identifiers.
- Do not delete the 0.5.1 package.
- Do not uninstall the active solution folder as a rollback technique.
- If a later activation fails, use the supported in-place rollback/version operation for the existing deployment. Do not uninstall the solution folder.
- The coded app remains on its current independent deployment and does not require rollback for this solution-only change.

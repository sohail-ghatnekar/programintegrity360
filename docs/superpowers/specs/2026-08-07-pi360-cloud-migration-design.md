# Program Integrity 360 Cloud Migration Design

## Goal

Move the complete working Program Integrity 360 demo from staging to production Automation Cloud without changing or deleting the staging deployment.

## Destination

- UiPath URL: `https://cloud.uipath.com`
- API URL: `https://api.uipath.com`
- Organization: `uipathlabs`
- Tenant: `Playground`
- Parent folder: `AMER Presales/Public Sector`
- Parent folder key: `7ea9add1-8aa5-4829-8939-0964c751b123`
- Solution folder: `ProgramIntegrity360`
- Coded web app URL: `https://uipathlabs.uipath.host/pi360-coded-app`

## OAuth Contract

The coded web app uses authorization-code with PKCE as a public client. It must not request, store, or use a client secret.

- Client ID: `57201488-1566-4f9b-a696-1b3773c2af33`
- Local redirect URI: `http://localhost:5173`
- Deployed redirect URI: `https://uipathlabs.uipath.host/pi360-coded-app`
- Authorization endpoint: `https://cloud.uipath.com/identity_/connect/authorize`
- Token endpoint: `https://cloud.uipath.com/identity_/connect/token`
- Discovery endpoint: `https://cloud.uipath.com/identity_/.well-known/openid-configuration`

The app requests exactly these scopes:

`OR.Administration.Read OR.Assets.Read OR.Buckets OR.Buckets.Read OR.Buckets.Write OR.Execution.Read OR.Folders.Read OR.Jobs.Read OR.Jobs.Write OR.Queues.Read OR.Tasks OR.Tasks.Read OR.Tasks.Write PIMS DataFabric.Data.Read DataFabric.Data.Write DataFabric.Schema.Read ConversationalAgents`

## Transfer Boundary

The runtime transfer includes the tested `ProgramIntegrity360 0.5.1` solution package, all 15 registered projects, both coded Action Apps, the separately deployed coded web app, editable Studio Web source, ten Data Fabric choice sets, nine Data Fabric entities, and 52 synthetic seed records.

Queues, buckets, triggers, assets, credentials, and Integration Service connections described only in `platform/data-fabric-and-plumbing.md` are not silently created. The source document says those commands were design notes and the `0.5.1` package contains no such resources. Creating placeholder infrastructure would not reproduce a known-working source state.

## Migration Architecture

The tested `ProgramIntegrity360_0.5.1.zip` is promoted unchanged to the destination feed. Environment identity is supplied at deployment time through the destination parent folder and deployment configuration. The solution is initially deployed inactive, verified, then activated after the Data Fabric layer is ready.

Data Fabric is recreated at tenant level, matching the source. New choice-set NumberIds and entity UUIDs are captured in destination-specific ID maps; staging ID files remain untouched. The canonical repository fixtures are transformed exactly as the source seeding scripts specify and inserted through the `uip df` CLI.

The coded web app remains outside the solution package. Its committed configuration is changed to the production API, public OAuth client, exact granted scopes, and the destination solution-folder identities. It is rebuilt, packed as version `0.5.0`, published, and deployed non-interactively using the new folder key.

## Deployment Sequence

1. Verify CLI auth, current tenant, tool surfaces, destination collisions, and the source package checksum.
2. Update and test the local production OAuth configuration without touching staging.
3. Publish the unchanged solution package and deploy it inactive under the Public Sector parent folder.
4. Resolve the new solution folder GUID and numeric Orchestrator folder ID.
5. Preview the exact Data Fabric schema and obtain the mandatory schema-write approval.
6. Create choice sets, create entities, seed records, and verify authoritative counts.
7. Inspect the inactive solution deployment, activate it, and verify all resources.
8. Upload editable solution source to destination Studio Web.
9. Rebuild, pack, publish, and deploy the coded web app to the solution folder.
10. Verify OAuth, live case/task discovery, the conversational agent, six stages, both Action Apps, Flow, BPMN, RPA, API Workflow, and the seeded demo case.

## Failure Handling

- Staging is never modified or deleted.
- A failed target solution remains inactive for diagnosis; it is not automatically uninstalled.
- Data Fabric objects are never deleted automatically. Cleanup requires a separate target preview and explicit approval.
- A failed coded-app release does not replace the source artifact or staging deployment.
- Every cloud mutation is followed by a read-back verification; CLI exit codes alone are insufficient.

## Acceptance Criteria

- `ProgramIntegrity360 0.5.1` is published and active in cloud Playground.
- Exactly one solution folder exists at `AMER Presales/Public Sector/ProgramIntegrity360`.
- All 15 solution projects are represented in the active deployment.
- Ten PI360 choice sets, nine PI360 entities, and 52 seed rows exist at tenant scope.
- The coded web app is reachable at the registered deployed redirect URL.
- OAuth uses PKCE with the supplied public client and requests exactly the 18 granted scopes.
- The app reads the new folder key/ID, loads live case and task data, and can invoke the record conversation agent.
- Local app tests, lint, and production build pass after configuration changes.
- Destination IDs and URLs are documented without overwriting staging rollback information.


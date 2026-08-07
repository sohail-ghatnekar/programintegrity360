# Deploy — Program Integrity 360

The production Automation Cloud migration was completed on 2026-08-07. All data is synthetic.

## Destination

- Portal: `https://cloud.uipath.com`
- Organization: `uipathlabs`
- Tenant: `Playground`
- Parent folder: `AMER Presales/Public Sector`
- Solution folder: `AMER Presales/Public Sector/ProgramIntegrity360`
- Folder key: `5db31dd1-1073-4f9e-b44b-76f5484e03c4`
- Solution package: `ProgramIntegrity360` `0.5.1`
- Coded app: `pi360-coded-app` `0.5.3`
- App URL: `https://uipathlabs.uipath.host/pi360-coded-app`

The authoritative identifiers and checksums are in `platform/cloud-playground-migration.json`.

## Deployed state

- Solution activation: `SuccessfulActivate`
- Editable Studio Web source: 15 projects uploaded with no project errors
- Data Fabric: 10 tenant choice sets, 9 tenant entities, and 52 seed records
- Coded app deployment revision: 4
- Source staging environment: retained and not modified

## OAuth gate

The coded app uses authorization-code with PKCE as a public client. It requests exactly the 18 scopes in `ProgramIntegrity360/PI360CodedApp/uipath.json`, does not request `offline_access`, and never uses a client secret.

External app `57201488-1566-4f9b-a696-1b3773c2af33` must grant every configured scope. Live validation currently returns `invalid_scope` because these three grants are missing from the external app registration:

- `DataFabric.Data.Read`
- `DataFabric.Data.Write`
- `DataFabric.Schema.Read`

After an external-app administrator adds them, rerun the browser sign-in check at the hosted app URL.

## Rebuild and upgrade the coded app

Run from `ProgramIntegrity360/PI360CodedApp` after an interactive production login:

```bash
npm test
npm run lint
npm run build
uip codedapp pack dist --name pi360-coded-app --version <next-version> -o .uipath
uip codedapp publish --name pi360-coded-app --version <next-version> --base-url https://cloud.uipath.com --tenant-name Playground --output json
uip codedapp deploy --name pi360-coded-app --version <next-version> --client-id 57201488-1566-4f9b-a696-1b3773c2af33 --base-url https://cloud.uipath.com --org-name uipathlabs --tenant-id 15eb07e5-edfb-4fcc-9229-7681ff056ff0 --folder-key 5db31dd1-1073-4f9e-b44b-76f5484e03c4 --output json
```

The current CLI overwrites `.uipath/app.config.json` during publish. Before an in-place upgrade, confirm that file still contains deployment ID `12eb1198-bd15-49e8-a009-d17410ad0477`; otherwise restore the recorded deployment ID and app URL from the migration ledger before running `deploy`.

## Verification

```bash
uip user --output json
uip solution deploy status 30c60010-f31f-4d6e-d26d-08def493cb98 --output json
uip or folders list --all --name ProgramIntegrity360 --output json
uip df entities list --include-folders --native-only --output json
curl -sS https://uipathlabs.uipath.host/pi360-coded-app
```

Require the active solution instance, the exact folder key, nine `PI360*` entities, HTTP 200, production metadata, the exact client ID, exact scopes, and exact redirect URI.

## Rollback

For an app-only rollback, redeploy the previously published `pi360-coded-app` version `0.5.2` against the same deployment ID and folder. The production solution package remains `0.5.1` and does not need rollback for an app-only issue.

The previous staging deployment under `AMER Presales/Public Sector/ProgramIntegrity360 1` remains the untouched source fallback. Do not delete or mutate it during production rollback.

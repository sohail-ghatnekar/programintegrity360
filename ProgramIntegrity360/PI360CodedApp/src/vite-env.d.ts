/// <reference types="vite/client" />

declare const __UIPATH_DEFAULTS__: {
  clientId?: string;
  orgName?: string;
  tenantName?: string;
  baseUrl?: string;
  redirectUri?: string;
  scope?: string;
};

interface ImportMetaEnv {
  readonly VITE_COMMENTS_ENTITY_ID?: string;
  readonly VITE_COMMENTS_CLAIM_FIELD?: string;
  readonly VITE_COMMENTS_TEXT_FIELD?: string;
  readonly VITE_COMMENTS_AUTHOR_FIELD?: string;
  readonly VITE_COMMENTS_AUTHOR_NAME_FIELD?: string;
  readonly VITE_COMMENTS_TIMESTAMP_FIELD?: string;
  readonly VITE_COMMENTS_ORDER_FIELD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

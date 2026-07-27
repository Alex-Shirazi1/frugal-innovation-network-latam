/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PostHog project API key (starts with `phc_`). Analytics is disabled when unset. */
  readonly VITE_POSTHOG_KEY?: string
  /** PostHog ingestion host. Defaults to US cloud (`https://us.i.posthog.com`). */
  readonly VITE_POSTHOG_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

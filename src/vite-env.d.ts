/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PostHog project API key (starts with `phc_`). Analytics is disabled when unset. */
  readonly VITE_POSTHOG_KEY?: string
  /** PostHog ingestion host. Defaults to US cloud (`https://us.i.posthog.com`). */
  readonly VITE_POSTHOG_HOST?: string

  /**
   * Which data source to use: 'bundled' (compiled-in data, no backend),
   * 'firestore' (hosted production backend) or 'http' (local Express dev API).
   * When unset, a complete Firebase config implies 'firestore', else 'http'.
   */
  readonly VITE_DATA_SOURCE?: 'bundled' | 'firestore' | 'http'
  /** Base URL for the http adapter. Defaults to `/api`. */
  readonly VITE_API_BASE_URL?: string

  /**
   * Where "Solicitud de nueva membresía" is delivered when someone completes the
   * join form. Prefer the opaque FormSubmit alias over a plain address: Vite
   * bakes this into the bundle, so an address here is readable on the live site.
   * Unset means no notification is sent and no request is made; submissions are
   * still stored and visible at /admin.
   */
  readonly VITE_NOTIFY_TARGET?: string

  /**
   * Firebase web config. API key, project id and app id must all be present for
   * the Firestore adapter to activate; the auth domain is derived from the
   * project id when omitted. These are publishable client identifiers, not
   * secrets — firestore.rules is the security boundary.
   */
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

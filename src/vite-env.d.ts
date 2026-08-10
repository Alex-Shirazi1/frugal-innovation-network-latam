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
   * Contact address sent to MyMemory as its `de=` parameter, raising the
   * translation quota from 5,000 to 50,000 characters a day. Vite bakes this
   * into the bundle, so it is readable on the live site and will be scraped —
   * use a throwaway address, not the network's inbox. It must still receive
   * mail: MyMemory asks for one so they can make contact if traffic looks
   * wrong, and blocks addresses that bounce. Unset means the anonymous quota.
   */
  readonly VITE_TRANSLATE_CONTACT?: string

  /**
   * Points the Firebase SDK at the local emulator suite instead of the real
   * project. Development only — the branch is also gated on import.meta.env.DEV.
   */
  readonly VITE_FIREBASE_EMULATOR?: string

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

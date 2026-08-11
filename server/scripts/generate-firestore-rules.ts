/**
 * Generates firestore.rules from the canonical option data.
 *
 * Firestore rules are their own language, so they cannot import
 * src/domain/intake.ts the way the browser and the dev server do. Rather than
 * maintain a hand-written third copy of every whitelist — which would drift the
 * moment someone adds a country — the enum lists are emitted from the same
 * TypeScript source, and server/firestore-rules-drift.test.ts fails the build
 * if the committed file no longer matches.
 *
 * Run with: npm run rules
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { institutions } from '../../src/data/institutions'
import {
  countries,
  fieldLimits,
  generalAreas,
  languageOptions,
  positionTypes,
  researchInterests,
} from '../../src/data/onboardingOptions'

const list = (values: readonly string[]): string =>
  `[${values.map((v) => `'${v.replace(/'/g, "\\'")}'`).join(', ')}]`

const regionMap = (): string => {
  const entries = countries.map((c) => `      '${c.name.replace(/'/g, "\\'")}': ${list(c.regions)}`)
  return `{\n${entries.join(',\n')}\n    }`
}

/**
 * Fields a client is allowed to send. Everything else about a member —
 * fullName, title, avatarHue, the approved copy — is derived, so accepting it
 * from the client would let a submitter forge their own display identity.
 */
const CLIENT_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'position',
  'jobPositionName',
  'biography',
  'affiliationId',
  'country',
  'region',
  'interestIds',
  'generalAreaIds',
  'languages',
  'socialUrl',
  'consentToPublish',
  'status',
  'createdAt',
]

const REQUIRED_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'position',
  'country',
  'region',
  'interestIds',
  'generalAreaIds',
  'languages',
  'consentToPublish',
  'status',
]

/**
 * Fields a PUBLISHED member record may contain — the output shape of
 * toPublishedMember in src/api/adminApi.ts.
 *
 * `email` is absent from this list on purpose, and that absence is the point.
 * `members` is world-readable, so an applicant's address landing here would put
 * it on the open web. adminApi builds the published record field by field
 * rather than by spreading the submission for the same reason; this list is the
 * half of that guarantee a client cannot skip. `hasOnly` turns "we remembered
 * not to copy the email across" into "the database refuses to store one".
 *
 * `consentToPublish`, `status`, and `createdAt` are queue bookkeeping and are
 * likewise not part of a published profile.
 */
const PUBLISHED_FIELDS = [
  'firstName',
  'lastName',
  'fullName',
  'title',
  'position',
  'jobPositionName',
  'biography',
  'affiliationId',
  'country',
  'region',
  'interestIds',
  'generalAreaIds',
  'languages',
  'socialUrl',
  'avatarHue',
]

/**
 * The subset without which a directory card cannot render. jobPositionName,
 * biography, socialUrl, and affiliationId are all legitimately absent for some
 * members, so they are validated when present rather than demanded.
 */
const PUBLISHED_REQUIRED_FIELDS = [
  'firstName',
  'lastName',
  'fullName',
  'title',
  'position',
  'country',
  'region',
  'interestIds',
  'generalAreaIds',
  'languages',
  'avatarHue',
]

export function buildRules(): string {
  return `rules_version = '2';

// GENERATED FILE — do not edit by hand.
// Produced by server/scripts/generate-firestore-rules.ts from the canonical
// option data in src/data/onboardingOptions.ts and src/data/institutions.ts.
// Regenerate with: npm run rules

service cloud.firestore {
  match /databases/{database}/documents {

    // ---- Identity ---------------------------------------------------------
    // Moderation is gated on a custom claim, not on merely being signed in.
    // Set it once per moderator with the Admin SDK (see docs/DEPLOYMENT.md).
    function isAdmin() {
      return request.auth != null && request.auth.token.admin == true;
    }

    // ---- Generated whitelists --------------------------------------------
    function positionTypes() { return ${list(positionTypes)}; }
    function interestIds() { return ${list(researchInterests.map((i) => i.id))}; }
    function areaIds() { return ${list(generalAreas.map((a) => a.id))}; }
    function languageIds() { return ${list(languageOptions.map((l) => l.id))}; }
    function affiliationIds() { return ${list(institutions.map((i) => i.id))}; }
    function regionsByCountry() {
      return ${regionMap()};
    }

    // ---- Field-level validation ------------------------------------------
    function textWithin(value, maxLen) {
      return value is string && value.size() <= maxLen;
    }

    function requiredText(value, maxLen) {
      return value is string && value.size() > 0 && value.size() <= maxLen;
    }

    // A list whose every entry is drawn from \`allowed\`, sized 1..maxLen.
    function idsFrom(value, allowed, maxLen) {
      return value is list
        && value.size() > 0
        && value.size() <= maxLen
        && value.hasOnly(allowed);
    }

    function validLocation(data) {
      return data.country is string
        && data.region is string
        && regionsByCountry().get(data.country, []).hasAny([data.region]);
    }

    function validAffiliation(data) {
      return !('affiliationId' in data.keys())
        || data.affiliationId == null
        || affiliationIds().hasAny([data.affiliationId]);
    }

    function validSocialUrl(data) {
      return !('socialUrl' in data.keys())
        || data.socialUrl == null
        || (textWithin(data.socialUrl, ${fieldLimits.socialUrl})
            && (data.socialUrl.matches('https://.*') || data.socialUrl.matches('http://.*')));
    }

    // The derived, translated card subtitle. Required whole rather than
    // es-only: it is generated from positionTitles, never typed, so a missing
    // language means the record was written by something other than the
    // approval path — which is exactly what this is here to catch.
    function localizedTitle(value) {
      return value is map
        && value.keys().hasOnly(['es', 'en', 'pt'])
        && requiredText(value.es, ${fieldLimits.jobPositionName})
        && requiredText(value.en, ${fieldLimits.jobPositionName})
        && requiredText(value.pt, ${fieldLimits.jobPositionName});
    }

    function validSubmission(data) {
      return data.keys().hasOnly(${list(CLIENT_FIELDS)})
        && data.keys().hasAll(${list(REQUIRED_FIELDS)})
        && requiredText(data.firstName, ${fieldLimits.firstName})
        && requiredText(data.lastName, ${fieldLimits.lastName})
        // Enforced here as well as in the validator: rules are the only check a
        // client cannot skip, and an application with no reply address is
        // useless to the network.
        && requiredText(data.email, ${fieldLimits.email})
        && data.email.matches('^[^\\\\s@]+@[^\\\\s@]+[.][^\\\\s@]+$')
        && positionTypes().hasAny([data.position])
        && textWithin(data.jobPositionName, ${fieldLimits.jobPositionName})
        && textWithin(data.biography, ${fieldLimits.biography})
        && validLocation(data)
        && validAffiliation(data)
        && idsFrom(data.interestIds, interestIds(), ${fieldLimits.maxTechnicalInterests})
        && idsFrom(data.generalAreaIds, areaIds(), ${fieldLimits.maxGeneralAreas})
        && idsFrom(data.languages, languageIds(), ${fieldLimits.maxLanguages})
        && validSocialUrl(data)
        // Consent is a stored gate, not just UI copy — this is real PII.
        && data.consentToPublish == true
        // A submitter cannot self-approve.
        && data.status == 'pending';
    }

    /**
     * A published directory record.
     *
     * Validated even though only a moderator can write here, for two reasons.
     * The directory is the one collection the whole world can read, so a bad
     * write is immediately public rather than merely wrong. And a moderator
     * account is exactly what an attacker would be using — shape validation is
     * what stops a stolen session from turning a real person's profile into
     * whatever it likes, or from quietly publishing their email address.
     *
     * Display fields are derived by the approval path, never typed, so they can
     * be checked strictly here: fullName against its parts, title against the
     * generated translations, avatarHue against the range avatarHueFor emits.
     */
    function validMember(data) {
      return data.keys().hasOnly(${list(PUBLISHED_FIELDS)})
        && data.keys().hasAll(${list(PUBLISHED_REQUIRED_FIELDS)})
        && requiredText(data.firstName, ${fieldLimits.firstName})
        && requiredText(data.lastName, ${fieldLimits.lastName})
        && requiredText(data.fullName, ${fieldLimits.firstName + fieldLimits.lastName + 1})
        && localizedTitle(data.title)
        && positionTypes().hasAny([data.position])
        && (!('jobPositionName' in data.keys())
            || textWithin(data.jobPositionName, ${fieldLimits.jobPositionName}))
        && (!('biography' in data.keys()) || textWithin(data.biography, ${fieldLimits.biography}))
        && validAffiliation(data)
        && validLocation(data)
        && idsFrom(data.interestIds, interestIds(), ${fieldLimits.maxTechnicalInterests})
        && idsFrom(data.generalAreaIds, areaIds(), ${fieldLimits.maxGeneralAreas})
        && idsFrom(data.languages, languageIds(), ${fieldLimits.maxLanguages})
        && validSocialUrl(data)
        // avatarHueFor returns an integer hue in [0, 360).
        && data.avatarHue is int
        && data.avatarHue >= 0
        && data.avatarHue < 360;
    }

    // ---- Collections ------------------------------------------------------

    // Intake queue. Deliberately NOT publicly readable: it holds personal data
    // for people who have not been approved for publication yet.
    match /submissions/{submissionId} {
      allow create: if validSubmission(request.resource.data);
      allow read, update, delete: if isAdmin();
    }

    // The published directory. World-readable by design; only a moderator
    // writes here, and only by copying an approved submission across.
    // Delete is stated separately from create and update throughout: a delete
    // carries no request.resource, so folding it in with a shape check would
    // evaluate the validator against null and deny every removal.
    match /members/{memberId} {
      allow read: if true;
      allow create, update: if isAdmin() && validMember(request.resource.data);
      allow delete: if isAdmin();
    }

    // ---- Editable site content -------------------------------------------
    // Iniciativas and the bibliography: shown to everyone, written only by a
    // moderator. Shape is validated even for admins — a typo in the dashboard
    // should not be able to write a document the renderer cannot read.

    function editableText(value) {
      return value is map
        && value.keys().hasOnly(['es', 'en', 'pt'])
        && requiredText(value.es, 300)
        && (!('en' in value.keys()) || textWithin(value.en, 300))
        && (!('pt' in value.keys()) || textWithin(value.pt, 300));
    }

    function validInitiative(data) {
      return data.keys().hasOnly(['order', 'title', 'text', 'url', 'cta'])
        && data.keys().hasAll(['order', 'title', 'text'])
        && data.order is int
        && editableText(data.title)
        && editableText(data.text)
        && (!('url' in data.keys()) || data.url == null
            || (textWithin(data.url, 500) && data.url.matches('https?://.*')))
        && (!('cta' in data.keys()) || data.cta == null || editableText(data.cta));
    }

    function validBibliographyEntry(data) {
      return data.keys().hasOnly(['paperNumber', 'title', 'authors', 'year', 'language', 'file', 'sizeKb'])
        && data.keys().hasAll(['paperNumber', 'title', 'authors', 'language', 'file'])
        && requiredText(data.paperNumber, 20)
        && requiredText(data.title, 500)
        && textWithin(data.authors, 500)
        && (data.year == null || data.year is int)
        && data.language in ['EN', 'ES']
        && requiredText(data.file, 500)
        && (!('sizeKb' in data.keys()) || data.sizeKb is number);
    }

    match /initiatives/{initiativeId} {
      allow read: if true;
      allow create, update: if isAdmin() && validInitiative(request.resource.data);
      allow delete: if isAdmin();
    }

    function localizedText(value) {
      return value is map
        && value.keys().hasOnly(['es', 'en', 'pt'])
        && requiredText(value.es, 500);
    }

    function validResource(data) {
      return data.keys().hasOnly(['title', 'language', 'author', 'year', 'type', 'file', 'summary'])
        && data.keys().hasAll(['title', 'language', 'type', 'file'])
        && localizedText(data.title)
        && (!('summary' in data.keys()) || localizedText(data.summary))
        && data.language in ['ES', 'EN', 'PT']
        && data.type in ['PDF', 'Guía', 'Artículo', 'Bibliografía']
        && (!('author' in data.keys()) || textWithin(data.author, 300))
        && (!('year' in data.keys()) || data.year is int)
        && requiredText(data.file, 500);
    }

    function validCongress(data) {
      return data.keys().hasOnly(['kicker', 'title', 'subtitle', 'details', 'siteCta', 'siteUrl'])
        && data.keys().hasAll(['kicker', 'title', 'subtitle', 'details', 'siteCta', 'siteUrl'])
        && editableText(data.kicker)
        && editableText(data.title)
        && editableText(data.subtitle)
        && editableText(data.details)
        && editableText(data.siteCta)
        && textWithin(data.siteUrl, 500)
        && data.siteUrl.matches('https?://.*');
    }

    match /resources/{resourceId} {
      allow read: if true;
      allow create, update: if isAdmin() && validResource(request.resource.data);
      allow delete: if isAdmin();
    }

    // One-off editable blocks. Only the congress document is defined; anything
    // else in this collection is denied rather than accepted with no shape.
    match /siteContent/congress {
      allow read: if true;
      allow create, update: if isAdmin() && validCongress(request.resource.data);
      allow delete: if isAdmin();
    }

    match /bibliography/{entryId} {
      allow read: if true;
      allow create, update: if isAdmin() && validBibliographyEntry(request.resource.data);
      allow delete: if isAdmin();
    }

    // Anything not matched above is denied.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  const outFile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'firestore.rules')
  writeFileSync(outFile, buildRules())
  console.log(`wrote ${outFile}`)
}

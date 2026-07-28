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
  'position',
  'country',
  'region',
  'interestIds',
  'generalAreaIds',
  'languages',
  'consentToPublish',
  'status',
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

    function validSubmission(data) {
      return data.keys().hasOnly(${list(CLIENT_FIELDS)})
        && data.keys().hasAll(${list(REQUIRED_FIELDS)})
        && requiredText(data.firstName, ${fieldLimits.firstName})
        && requiredText(data.lastName, ${fieldLimits.lastName})
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

    // ---- Collections ------------------------------------------------------

    // Intake queue. Deliberately NOT publicly readable: it holds personal data
    // for people who have not been approved for publication yet.
    match /submissions/{submissionId} {
      allow create: if validSubmission(request.resource.data);
      allow read, update, delete: if isAdmin();
    }

    // The published directory. World-readable by design; only a moderator
    // writes here, and only by copying an approved submission across.
    match /members/{memberId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
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

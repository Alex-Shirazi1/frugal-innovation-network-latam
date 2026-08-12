/**
 * RELIF — incorporation-form transport.
 *
 * Runs inside Google Apps Script, bound to the private incorporation form. On
 * every submission it deposits the response into Firestore, where the admin panel
 * maps it and a moderator publishes the profile.
 *
 * Installation is documented in docs/DEPLOYMENT.md, "Wiring the incorporation
 * form". This file is committed to the repository on purpose: code that exists
 * only inside somebody's Google account is code the next maintainer cannot find,
 * and this project is being handed over.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It does not map answers onto the site's vocabularies. Interests, areas,
 * languages, institutions, positions, countries and regions are all controlled
 * lists that live in src/data/onboardingOptions.ts and src/data/institutions.ts,
 * are generated into firestore.rules, and are guarded by a drift test that fails
 * the build if the two diverge. A second copy of those lists here would be a copy
 * nothing checks — it would silently start rejecting people the day a country is
 * added to the site. So this script is deliberately dumb: it forwards question
 * titles and answers verbatim and lets the panel do the mapping.
 *
 * It also does not publish anybody. The account it signs in as carries the
 * `importer` claim, which permits exactly one thing: creating documents in
 * formResponses. It cannot read them back and it cannot write to the public
 * directory. If this script's password leaks, the worst available outcome is junk
 * in a moderator-only inbox.
 * ---------------------------------------------------------------------------
 */

/**
 * Set these in Project Settings > Script properties, never in this file.
 * A password committed to a public repository is a password that has to be
 * rotated, and this repository is public.
 *
 *   FIREBASE_API_KEY     Web API key (publishable — the same one the site ships)
 *   FIREBASE_PROJECT_ID  e.g. raif-af800
 *   IMPORTER_EMAIL       the transport account created with `--importer`
 *   IMPORTER_PASSWORD    that account's password
 */
function config_() {
  const properties = PropertiesService.getScriptProperties();
  const required = [
    'FIREBASE_API_KEY',
    'FIREBASE_PROJECT_ID',
    'IMPORTER_EMAIL',
    'IMPORTER_PASSWORD',
  ];

  const settings = {};
  const missing = [];
  required.forEach(function (name) {
    const value = properties.getProperty(name);
    if (!value) missing.push(name);
    settings[name] = value;
  });

  if (missing.length) {
    throw new Error(
      'Missing script properties: ' +
        missing.join(', ') +
        '. See docs/DEPLOYMENT.md, "Wiring the incorporation form".',
    );
  }
  return settings;
}

/**
 * Exchanges the transport account's password for a Firebase ID token.
 *
 * An ID token rather than a service-account key on purpose. A service account
 * authenticates against the Cloud Firestore API through IAM, which BYPASSES
 * security rules entirely — the shape checks in firestore.rules would simply not
 * run. Signing in as a real Firebase Auth user keeps every rule in force, so this
 * transport is held to the same validation as any other client.
 */
function signIn_(settings) {
  const response = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' +
      encodeURIComponent(settings.FIREBASE_API_KEY),
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        email: settings.IMPORTER_EMAIL,
        password: settings.IMPORTER_PASSWORD,
        returnSecureToken: true,
      }),
    },
  );

  const body = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200 || !body.idToken) {
    throw new Error(
      'Transport sign-in failed (' +
        response.getResponseCode() +
        '): ' +
        (body.error && body.error.message ? body.error.message : 'unknown'),
    );
  }
  return body.idToken;
}

/** Firestore REST wants every value tagged with its type. Answers are strings. */
function toFirestoreFields_(answers) {
  const fields = {};
  Object.keys(answers).forEach(function (question) {
    fields[question] = { stringValue: String(answers[question]) };
  });
  return fields;
}

/**
 * Flattens a form submission into question title to answer.
 *
 * Checkbox questions return an array; they are joined with ", " because that is
 * what a Sheets export produces and what the panel's splitter expects, so both
 * transports normalise to the same shape.
 */
function toAnswers_(formResponse) {
  const answers = {};
  formResponse.getItemResponses().forEach(function (itemResponse) {
    const value = itemResponse.getResponse();
    answers[itemResponse.getItem().getTitle()] = Array.isArray(value)
      ? value.join(', ')
      : String(value == null ? '' : value);
  });
  return answers;
}

/**
 * Trigger entry point. Install with: Triggers > Add Trigger > On form submit.
 *
 * Throwing is the correct failure mode: Apps Script records the failed run and
 * emails the script owner, which is the only notification channel available here.
 * Swallowing the error would lose a vetted applicant silently, which is the exact
 * failure this pipeline is built to avoid.
 */
function onFormSubmit(event) {
  const settings = config_();

  if (!event || !event.response) {
    throw new Error('No form response on the event — is the trigger "On form submit"?');
  }

  const answers = toAnswers_(event.response);
  const questionCount = Object.keys(answers).length;
  // firestore.rules caps a deposit at 40 answers. Failing here names the reason;
  // failing at the rules boundary would only produce an opaque 403.
  if (questionCount === 0 || questionCount > 40) {
    throw new Error('Response has ' + questionCount + ' answers; the rules allow 1 to 40.');
  }

  const idToken = signIn_(settings);
  const response = UrlFetchApp.fetch(
    'https://firestore.googleapis.com/v1/projects/' +
      encodeURIComponent(settings.FIREBASE_PROJECT_ID) +
      '/databases/(default)/documents/formResponses',
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + idToken },
      payload: JSON.stringify({
        fields: {
          answers: { mapValue: { fields: toFirestoreFields_(answers) } },
          receivedAt: { stringValue: new Date().toISOString() },
        },
      }),
    },
  );

  if (response.getResponseCode() >= 300) {
    throw new Error(
      'Firestore rejected the deposit (' +
        response.getResponseCode() +
        '): ' +
        response.getContentText(),
    );
  }

  console.log('Deposited a response with ' + questionCount + ' answers.');
}

/**
 * Run once by hand to check the configuration end to end.
 *
 * Deposits a clearly-labelled response so it is obvious in the panel and can be
 * discarded. Verifies the sign-in, the claim, and the rules in one go.
 */
function testTransport() {
  const settings = config_();
  const idToken = signIn_(settings);
  const response = UrlFetchApp.fetch(
    'https://firestore.googleapis.com/v1/projects/' +
      encodeURIComponent(settings.FIREBASE_PROJECT_ID) +
      '/databases/(default)/documents/formResponses',
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + idToken },
      payload: JSON.stringify({
        fields: {
          answers: {
            mapValue: {
              fields: toFirestoreFields_({
                Nombre: 'PRUEBA',
                Apellido: 'DESCARTAR',
                'Correo electrónico': 'prueba@example.org',
              }),
            },
          },
          receivedAt: { stringValue: new Date().toISOString() },
        },
      }),
    },
  );
  console.log(response.getResponseCode() + ' ' + response.getContentText());
}

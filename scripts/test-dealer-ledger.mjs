import { readFileSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8'));
const LOG = join(__dirname, '../debug-bbfd20.log');

function log(payload) {
  const line = JSON.stringify({ sessionId: 'bbfd20', timestamp: Date.now(), ...payload }) + '\n';
  appendFileSync(LOG, line);
  console.log(JSON.stringify(payload, null, 2));
}

const email = process.argv[2] || 'debug.dealer.1781642870167@crystalfurnitech.com';
const password = process.argv[3] || 'dealer123';

const app = initializeApp({
  apiKey: cfg.apiKey,
  authDomain: cfg.authDomain,
  projectId: cfg.projectId,
  storageBucket: cfg.storageBucket,
  messagingSenderId: cfg.messagingSenderId,
  appId: cfg.appId,
});
const auth = getAuth(app);
const db = initializeFirestore(app, {}, cfg.firestoreDatabaseId);

try {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  log({ location: 'test-dealer-ledger:auth', message: 'signed in', data: { email, uid }, hypothesisId: 'B' });

  for (const name of ['categories', 'products', 'requirements', 'ledger']) {
    try {
      let snap;
      if (name === 'ledger' || name === 'requirements') {
        snap = await getDocs(query(collection(db, name), where('dealerId', '==', uid)));
      } else {
        snap = await getDocs(collection(db, name));
      }
      log({
        location: `test-dealer-ledger:${name}`,
        message: 'query ok',
        data: { count: snap.size },
        hypothesisId: name === 'ledger' ? 'A,C' : 'other',
      });
    } catch (err) {
      log({
        location: `test-dealer-ledger:${name}:fail`,
        message: 'query failed',
        data: { error: err?.message || String(err), code: err?.code },
        hypothesisId: name === 'ledger' ? 'A,C' : 'other',
      });
    }
  }

  // REST ledger query
  const idToken = await cred.user.getIdToken();
  const restUrl = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents:runQuery`;
  const restRes = await fetch(restUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'ledger' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'dealerId' },
            op: 'EQUAL',
            value: { stringValue: uid },
          },
        },
      },
    }),
  });
  const restText = await restRes.text();
  log({
    location: 'test-dealer-ledger:ledgerRest',
    message: restRes.ok ? 'REST ok' : 'REST fail',
    data: { status: restRes.status, body: restText.slice(0, 400) },
    hypothesisId: 'A,C',
  });
} catch (err) {
  log({
    location: 'test-dealer-ledger:fatal',
    message: 'fatal',
    data: { error: err?.message || String(err), code: err?.code },
    hypothesisId: 'A,B,C',
  });
  process.exit(1);
}

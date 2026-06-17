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
  appendFileSync(LOG, JSON.stringify({ sessionId: 'bbfd20', timestamp: Date.now(), ...payload }) + '\n');
  console.log(JSON.stringify(payload, null, 2));
}

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

const cred = await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', process.argv[2] || 'admin123');
log({ location: 'test-admin-ledger', message: 'admin signed in', data: { uid: cred.user.uid, email: cred.user.email } });

for (const [label, q] of [
  ['ledger-all', collection(db, 'ledger')],
  ['ledger-filter', query(collection(db, 'ledger'), where('dealerId', '==', 'YJ8T1sfB4LdFh5Z4u6pt9429aly1'))],
]) {
  try {
    const snap = await getDocs(q);
    log({ location: `test-admin-ledger:${label}`, message: 'ok', data: { count: snap.size } });
  } catch (err) {
    log({ location: `test-admin-ledger:${label}`, message: 'fail', data: { error: err.message, code: err.code } });
  }
}

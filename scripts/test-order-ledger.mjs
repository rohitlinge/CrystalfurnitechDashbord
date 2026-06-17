import { readFileSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8'));
const LOG = join(__dirname, '../debug-bbfd20.log');

function log(payload) {
  appendFileSync(LOG, JSON.stringify({ sessionId: 'bbfd20', timestamp: Date.now(), runId: 'post-fix', ...payload }) + '\n');
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

const email = 'debug.dealer.1781642870167@crystalfurnitech.com';
const password = 'dealer123';
const cred = await signInWithEmailAndPassword(auth, email, password);
const uid = cred.user.uid;
const idToken = await cred.user.getIdToken();

const productsSnap = await getDocs(collection(db, 'products'));
const product = productsSnap.docs[0]?.data();
if (!product) throw new Error('no products');

const reqId = 'req_test_' + Date.now().toString(36).slice(2, 8);
const orderValue = (product.wholesalePrice || product.price || 1000) * 1;
const req = {
  id: reqId,
  dealerId: uid,
  productId: product.id || productsSnap.docs[0].id,
  productName: product.name,
  quantityRequested: 1,
  requestedDate: new Date().toISOString(),
  status: 'Pending',
  orderValue,
};

const base = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents`;

// write requirement
let res = await fetch(`${base}/requirements?documentId=${encodeURIComponent(reqId)}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: toFields(req) }),
});
log({ location: 'test-order-ledger:req', message: res.ok ? 'req ok' : 'req fail', data: { status: res.status, body: (await res.text()).slice(0, 200) }, hypothesisId: 'D' });

// patch dealer outstanding
const dealerRes = await fetch(`${base}/dealers/${uid}`, { headers: { Authorization: `Bearer ${idToken}` } });
const dealerBody = await dealerRes.json();
const current = parseInt(dealerBody.fields?.outstandingBalance?.integerValue || '0', 10);
const newBalance = current + orderValue;
res = await fetch(`${base}/dealers/${uid}?updateMask.fieldPaths=outstandingBalance`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: { outstandingBalance: { integerValue: String(newBalance) } } }),
});
log({ location: 'test-order-ledger:patchDealer', message: res.ok ? 'patch ok' : 'patch fail', data: { status: res.status, body: (await res.text()).slice(0, 300) }, hypothesisId: 'D' });

// write ledger
const ledId = 'led_test_' + Date.now().toString(36).slice(2, 8);
const entry = {
  id: ledId,
  dealerId: uid,
  date: new Date().toISOString(),
  description: 'Order Amount — test',
  debit: orderValue,
  credit: 0,
  balance: newBalance,
  type: 'order',
  referenceId: reqId,
};
res = await fetch(`${base}/ledger?documentId=${encodeURIComponent(ledId)}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: toFields(entry) }),
});
log({ location: 'test-order-ledger:ledgerWrite', message: res.ok ? 'ledger ok' : 'ledger fail', data: { status: res.status, body: (await res.text()).slice(0, 300) }, hypothesisId: 'D,E' });

function toFields(data) {
  const fields = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'number') {
      fields[key] = Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  return fields;
}

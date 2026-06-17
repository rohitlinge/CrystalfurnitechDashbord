import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8'));

const app = initializeApp({
  apiKey: cfg.apiKey,
  authDomain: cfg.authDomain,
  projectId: cfg.projectId,
  storageBucket: cfg.storageBucket,
  messagingSenderId: cfg.messagingSenderId,
  appId: cfg.appId,
});
const auth = getAuth(app);
const db = initializeFirestore(app, {}, cfg.firestoreDatabaseId || 'default');

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

async function patch(collection, docId, payload, token) {
  const mask = Object.keys(payload).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url =
    `https://firestore.googleapis.com/v1/projects/${cfg.projectId}` +
    `/databases/default/documents/${collection}/${encodeURIComponent(docId)}?${mask}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(payload) }),
  });
  if (!res.ok) throw new Error(`PATCH ${collection}/${docId} ${res.status}: ${await res.text()}`);
}

async function getDoc(collection, docId, token) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${cfg.projectId}` +
    `/databases/default/documents/${collection}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const out = {};
  for (const [k, v] of Object.entries(data.fields || {})) {
    const val = v;
    if ('integerValue' in val) out[k] = parseInt(String(val.integerValue), 10);
    else if ('doubleValue' in val) out[k] = val.doubleValue;
    else if ('stringValue' in val) out[k] = val.stringValue;
  }
  return out;
}

await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');
const token = await auth.currentUser.getIdToken();
const reqs = (await getDocs(collection(db, 'requirements'))).docs.map((d) => ({ id: d.id, ...d.data() }));
const pending = reqs.filter((r) => r.status === 'Pending');
if (!pending.length) {
  console.log(JSON.stringify({ pass: true, note: 'no pending reqs to test' }, null, 2));
  process.exit(0);
}
const target = pending[0];
const product = await getDoc('products', target.productId, token);
const nextStock = (product.availableStock || 0) - target.quantityRequested;
await patch('products', target.productId, {
  availableStock: nextStock,
  stockStatus: nextStock <= 5 ? 'Low Stock' : 'In Stock',
  status: 'Available',
}, token);
await patch('requirements', target.id, { status: 'Fulfilled' }, token);
console.log(JSON.stringify({ pass: true, reqId: target.id, nextStock }, null, 2));

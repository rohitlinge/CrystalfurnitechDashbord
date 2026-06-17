import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

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

function fromFields(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('integerValue' in v) out[k] = parseInt(String(v.integerValue), 10);
    else if ('doubleValue' in v) out[k] = v.doubleValue;
    else if ('stringValue' in v) out[k] = v.stringValue;
  }
  return out;
}

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

async function runQuery(collectionId, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/default/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }] } }),
  });
  const rows = await res.json();
  if (!res.ok) throw new Error(`runQuery ${res.status}: ${JSON.stringify(rows)}`);
  return rows.filter((r) => r.document).map((r) => ({
    id: r.document.name.split('/').pop(),
    ...fromFields(r.document.fields),
  }));
}

async function getDoc(collection, docId, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/default/documents/${collection}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${collection}/${docId} ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return fromFields(data.fields);
}

async function patch(collection, docId, payload, token) {
  const mask = Object.keys(payload).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/default/documents/${collection}/${encodeURIComponent(docId)}?${mask}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(payload) }),
  });
  if (!res.ok) throw new Error(`PATCH ${collection}/${docId} ${res.status}: ${await res.text()}`);
}

async function fulfillViaRest(req, token) {
  const product = await getDoc('products', req.productId, token);
  if (!product) throw new Error('Product missing');
  const currentStock = product.availableStock || 0;
  const nextStock = currentStock - req.quantityRequested;
  await patch('products', req.productId, {
    availableStock: nextStock,
    stockStatus: nextStock <= 5 ? 'Low Stock' : 'In Stock',
    status: nextStock === 0 ? 'Out Of Stock' : 'Available',
  }, token);
  await patch('requirements', req.id, { status: 'Fulfilled' }, token);
  return { currentStock, nextStock };
}

await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');
const token = await auth.currentUser.getIdToken();

let reqs = await runQuery('requirements', token);
let pending = reqs.filter((r) => r.status === 'Pending');

if (!pending.length) {
  const products = await runQuery('products', token);
  const dealers = await runQuery('dealers', token);
  const approvedDealer = dealers.find((d) => d.role === 'dealer' && d.status === 'Approved');
  const product = products.find((p) => (p.availableStock || 0) >= 2);
  if (!approvedDealer || !product) {
    console.log(JSON.stringify({ error: 'Cannot seed pending req', dealers: dealers.length, products: products.length }, null, 2));
    process.exit(1);
  }
  const reqId = 'req_test_' + Date.now();
  const newReq = {
    id: reqId,
    dealerId: approvedDealer.uid || approvedDealer.id,
    dealerCompanyName: approvedDealer.companyName,
    productId: product.id,
    productName: product.name,
    quantityRequested: 2,
    requestedDate: new Date().toISOString(),
    status: 'Pending',
    notes: 'E2E test indent',
  };
  await setDoc(doc(db, 'requirements', reqId), newReq);
  pending = [newReq];
  console.log('Created test pending req:', reqId);
}

const target = pending[0];
try {
  const result = await fulfillViaRest(target, token);
  const after = await getDoc('requirements', target.id, token);
  const prodAfter = await getDoc('products', target.productId, token);
  console.log(JSON.stringify({
    pass: after?.status === 'Fulfilled',
    reqId: target.id,
    stockBefore: result.currentStock,
    stockAfter: prodAfter?.availableStock,
    statusAfter: after?.status,
  }, null, 2));
} catch (err) {
  console.log(JSON.stringify({
    pass: false,
    reqId: target.id,
    error: err.message,
  }, null, 2));
  process.exit(1);
}

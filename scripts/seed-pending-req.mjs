import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8'));
const app = initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
const auth = getAuth(app);
const db = initializeFirestore(app, {}, 'default');

async function runQuery(collectionId, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/default/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }] } }),
  });
  const rows = await res.json();
  return rows.filter((r) => r.document).map((r) => {
    const data = {};
    for (const [k, v] of Object.entries(r.document.fields || {})) {
      if ('integerValue' in v) data[k] = parseInt(String(v.integerValue), 10);
      else if ('stringValue' in v) data[k] = v.stringValue;
      else if ('doubleValue' in v) data[k] = v.doubleValue;
    }
    data.id = r.document.name.split('/').pop();
    return data;
  });
}

await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');
const token = await auth.currentUser.getIdToken();
const [products, dealers] = await Promise.all([runQuery('products', token), runQuery('dealers', token)]);
const dealer = dealers.find((d) => d.role === 'dealer' && d.status === 'Approved');
const product = products.find((p) => (p.availableStock || 0) >= 2);
const reqId = 'req_ui_' + Date.now();
await setDoc(doc(db, 'requirements', reqId), {
  dealerId: dealer.uid,
  dealerCompanyName: dealer.companyName,
  productId: product.id,
  productName: product.name,
  quantityRequested: 2,
  requestedDate: new Date().toISOString(),
  status: 'Pending',
});
console.log(JSON.stringify({ reqId, productId: product.id, stockBefore: product.availableStock }, null, 2));

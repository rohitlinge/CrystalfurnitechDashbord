import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8'));
const app = initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
const auth = getAuth(app);
const db = initializeFirestore(app, {}, cfg.firestoreDatabaseId);
await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');
const snap = await getDocs(collection(db, 'products'));
const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const issues = products.map((p) => ({
  id: p.id,
  name: p.name,
  missingMaterial: p.material == null || p.material === undefined,
  missingSku: !p.sku,
  missingName: !p.name,
  missingPrice: p.price == null && p.wholesalePrice == null,
  material: p.material,
}));
console.log(JSON.stringify({ count: products.length, issues }, null, 2));

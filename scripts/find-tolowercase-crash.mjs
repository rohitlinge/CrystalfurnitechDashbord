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

const [products, categories, dealers, requirements] = await Promise.all([
  getDocs(collection(db, 'products')).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
  getDocs(collection(db, 'categories')).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
  getDocs(collection(db, 'dealers')).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
  getDocs(collection(db, 'requirements')).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
]);

const searchTerm = '';
const q = searchTerm.toLowerCase();

function test(label, items, fn) {
  for (const item of items) {
    try {
      fn(item);
    } catch (e) {
      console.log('CRASH', label, item.id, e.message, JSON.stringify(item).slice(0, 200));
    }
  }
}

test('dealer-old-filter', dealers, (d) => {
  d.companyName.toLowerCase();
  d.ownerName.toLowerCase();
  d.email.toLowerCase();
  d.gstNumber.toLowerCase();
  d.city.toLowerCase();
  d.state.toLowerCase();
});

test('product-old-filter', products, (p) => {
  p.name.toLowerCase();
  p.sku.toLowerCase();
  p.category.toLowerCase();
});

test('req-old-filter', requirements, (r) => {
  r.dealerCompanyName.toLowerCase();
  r.productName.toLowerCase();
  r.status.toLowerCase();
});

test('category-old-filter', categories, (c) => {
  c.name.toLowerCase();
});

test('dealer-new-filter', products, (p) => {
  (p.name || '').toLowerCase().includes(q);
  (p.sku || '').toLowerCase().includes(q);
  (p.material || '').toLowerCase().includes(q);
});

console.log('done', { products: products.length, categories: categories.length, dealers: dealers.length, requirements: requirements.length });

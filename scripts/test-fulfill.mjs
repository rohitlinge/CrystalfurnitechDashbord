import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  initializeFirestore,
  collection,
  doc,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const firebaseAppletConfig = JSON.parse(
  readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8')
);

const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  projectId: firebaseAppletConfig.projectId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  appId: firebaseAppletConfig.appId,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {}, firebaseAppletConfig.firestoreDatabaseId || 'default');

async function main() {
  await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');
  const reqsSnap = await getDocs(collection(db, 'requirements'));
  const pending = reqsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.status === 'Pending');

  if (!pending.length) {
    console.log(JSON.stringify({ error: 'no pending requirements found', total: reqsSnap.size }, null, 2));
    process.exit(0);
  }

  const target = pending[0];
  console.log('Testing fulfill on:', {
    id: target.id,
    productId: target.productId,
    quantityRequested: target.quantityRequested,
    dealerId: target.dealerId,
    hasDealerId: !!target.dealerId,
  });

  try {
    await runTransaction(db, async (transaction) => {
      const reqRef = doc(db, 'requirements', target.id);
      const reqDoc = await transaction.get(reqRef);
      const reqData = reqDoc.data();
      const productRef = doc(db, 'products', reqData.productId);
      const productDoc = await transaction.get(productRef);
      const productData = productDoc.data();
      const currentStock = productData?.availableStock || 0;
      const nextStock = currentStock - reqData.quantityRequested;

      transaction.update(reqRef, { status: 'Fulfilled' });
      transaction.update(productRef, {
        availableStock: nextStock,
        stockStatus: nextStock === 0 ? 'Out of Stock' : nextStock <= 5 ? 'Low Stock' : 'In Stock',
        status: nextStock === 0 ? 'Out Of Stock' : 'Available',
      });
    });
    console.log(JSON.stringify({ success: true, reqId: target.id }, null, 2));
  } catch (err) {
    console.log(JSON.stringify({
      success: false,
      reqId: target.id,
      code: err?.code || null,
      message: err?.message || String(err),
    }, null, 2));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

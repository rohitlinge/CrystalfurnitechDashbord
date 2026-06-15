/**
 * One-time CLI script: creates the `requirements` collection in Firestore (default DB)
 * if it is missing. Run: npm run seed:requirements
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  initializeFirestore,
  enableNetwork,
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import firebaseAppletConfig from '../firebase-applet-config.json';
import type { DealerProfile, ProductItem, StockRequirement } from '../src/types';

const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  projectId: firebaseAppletConfig.projectId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  appId: firebaseAppletConfig.appId,
};

function buildSampleRequirements(dealer: DealerProfile, product: ProductItem): StockRequirement[] {
  const productName = product.name.length >= 3 ? product.name : `${product.name} Item`;
  return [
    {
      id: 'req_seed_1',
      dealerId: dealer.uid,
      dealerCompanyName: dealer.companyName,
      productId: product.id,
      productName,
      quantityRequested: 10,
      requestedDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      status: 'Pending',
      notes: 'Sample wholesale stock request — seeded for dashboard setup.',
    },
    {
      id: 'req_seed_2',
      dealerId: dealer.uid,
      dealerCompanyName: dealer.companyName,
      productId: product.id,
      productName,
      quantityRequested: 5,
      requestedDate: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
      status: 'Fulfilled',
      notes: 'Sample fulfilled order — seeded for dashboard setup.',
    },
  ];
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  firebaseAppletConfig.firestoreDatabaseId
);

async function main() {
  console.log('Signing in as admin...');
  await enableNetwork(db);
  await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');

  console.log(`Signed in as: ${auth.currentUser?.email} (${auth.currentUser?.uid})`);

  const reqsSnap = await getDocs(collection(db, 'requirements'));
  if (!reqsSnap.empty) {
    console.log(`requirements collection already has ${reqsSnap.size} document(s). Nothing to do.`);
    process.exit(0);
  }

  const dealersSnap = await getDocs(collection(db, 'dealers'));
  const dealerDoc =
    dealersSnap.docs.find((d) => {
      const data = d.data() as DealerProfile;
      return data.role === 'dealer' && data.status === 'Approved';
    }) ?? dealersSnap.docs.find((d) => (d.data() as DealerProfile).role === 'dealer');

  const productsSnap = await getDocs(collection(db, 'products'));
  const productDoc = productsSnap.docs[0];

  const dealer: DealerProfile | null = dealerDoc
    ? ({ ...dealerDoc.data(), uid: (dealerDoc.data().uid as string) || dealerDoc.id } as DealerProfile)
    : null;

  const product: ProductItem | null = productDoc
    ? ({ ...productDoc.data(), id: (productDoc.data().id as string) || productDoc.id } as ProductItem)
    : null;

  if (!dealer) {
    console.error('No dealer found in Firestore. Register and approve a dealer first, then re-run.');
    process.exit(1);
  }
  if (!product) {
    console.error('No product found. Seed products first (Initialize & Seed Live Database), then re-run.');
    process.exit(1);
  }

  const sampleReqs = buildSampleRequirements(dealer, product);
  console.log(`Creating ${sampleReqs.length} sample requirement(s) for dealer "${dealer.companyName}"...`);

  for (const req of sampleReqs) {
    await setDoc(doc(db, 'requirements', req.id), req);
    console.log(`  + ${req.id} (${req.status})`);
  }

  console.log('Done. Check Firebase Console -> Firestore -> default -> requirements');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

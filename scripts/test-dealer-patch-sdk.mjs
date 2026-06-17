import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, doc, updateDoc } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8'));
const app = initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
const auth = getAuth(app);
const db = initializeFirestore(app, {}, cfg.firestoreDatabaseId);
const cred = await signInWithEmailAndPassword(auth, 'debug.dealer.1781642870167@crystalfurnitech.com', 'dealer123');
const uid = cred.user.uid;
try {
  await updateDoc(doc(db, 'dealers', uid), { outstandingBalance: 100 });
  console.log('SDK patch ok');
} catch (e) {
  console.log('SDK patch fail', e.code, e.message);
}

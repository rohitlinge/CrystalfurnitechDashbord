import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8'));
const app = initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
const auth = getAuth(app);
const db = initializeFirestore(app, {}, cfg.firestoreDatabaseId);
const uid = 'YJ8T1sfB4LdFh5Z4u6pt9429aly1';
await signInWithEmailAndPassword(auth, 'debug.dealer.1781642870167@crystalfurnitech.com', 'dealer123');
const snap = await getDocs(query(collection(db, 'ledger'), where('dealerId', '==', uid)));
const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
console.log(JSON.stringify(entries, null, 2));

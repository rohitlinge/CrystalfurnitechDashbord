import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8'));
const app = initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
const auth = getAuth(app);
const cred = await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');
const token = await cred.user.getIdToken();
const uid = 'YJ8T1sfB4LdFh5Z4u6pt9429aly1';
const res = await fetch(`https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/default/documents/dealers/${uid}`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log(JSON.stringify(await res.json(), null, 2));

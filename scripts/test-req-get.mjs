import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf8'));
const app = initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
const auth = getAuth(app);

await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');
const token = await auth.currentUser.getIdToken();

const reqId = process.argv[2] || 'req_test_1781728968284';
const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/default/documents/requirements/${encodeURIComponent(reqId)}`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
console.log(JSON.stringify({ status: res.status, ok: res.ok, body: res.ok ? 'found' : await res.text() }, null, 2));

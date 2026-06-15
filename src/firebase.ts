import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  initializeFirestore, 
  enableNetwork,
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where,
  deleteDoc,
  runTransaction,
  type QueryConstraint,
  type DocumentSnapshot,
  type QuerySnapshot
} from 'firebase/firestore';
import { getStorage, ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DealerProfile, DealerStatus, ProductItem, StockRequirement, CategoryItem } from './types';

import firebaseAppletConfig from '../firebase-applet-config.json';

// Support VITE_ environment variables (commonly set on host environments like Vercel)
// with fallback to the local compiled firebase-applet-config.json representation.
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || firebaseAppletConfig.measurementId || ""
};

const databaseId = env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseAppletConfig.firestoreDatabaseId;

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, databaseId);

/** Wake Firestore network layer and wait until Auth token is ready for writes. */
async function prepareFirestoreWrite(): Promise<void> {
  await enableNetwork(db);
  if (!auth.currentUser) {
    await new Promise<void>((resolve) => {
      const unsub = onAuthStateChanged(auth, () => {
        unsub();
        resolve();
      });
      setTimeout(() => {
        unsub();
        resolve();
      }, 5000);
    });
  }
}

// Keep Firestore online from app start
prepareFirestoreWrite().catch(() => {});

/** Ensure the user is signed in before Firestore reads/writes. */
async function ensureAuthenticated(): Promise<void> {
  await prepareFirestoreWrite();
  if (auth.currentUser) return;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error('Not authenticated with Firebase. Please log in again.'));
    }, 8000);
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });
  });
}

/** Ensure admin Firebase Auth session for privileged operations. */
async function ensureAdminAuthenticated(): Promise<void> {
  await prepareFirestoreWrite();
  if (auth.currentUser?.email !== 'admin@crystalfurnitech.com') {
    await withTimeout(
      signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123'),
      12000,
      'Admin session required. Please log in again.'
    );
  }
  if (!auth.currentUser) {
    throw new Error('Admin session required. Please log in again.');
  }
}

function mapDocSnapshot<T>(snap: DocumentSnapshot): T | null {
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  return { ...data, id: (data.id as string) || snap.id } as T;
}

function mapQuerySnapshot<T>(snapshot: QuerySnapshot): T[] {
  return snapshot.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return { ...data, id: (data.id as string) || d.id } as T;
  });
}

/** Read a Firestore collection via SDK — single source of truth for all dashboards. */
async function fetchCollection<T>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  timeoutMsg?: string
): Promise<T[]> {
  await ensureAuthenticated();
  const colRef = collection(db, collectionName);
  const snapshot = constraints.length
    ? await withTimeout(
        getDocs(query(colRef, ...constraints)),
        15000,
        timeoutMsg || `${collectionName} request timed out.`
      )
    : await withTimeout(
        getDocs(colRef),
        15000,
        timeoutMsg || `${collectionName} request timed out.`
      );
  return mapQuerySnapshot<T>(snapshot);
}

/** Extract document ID from Firestore REST document name path. */
function restDocIdFromName(name: string): string {
  const parts = name.split('/');
  return parts[parts.length - 1] || name;
}

/** Convert a plain object to Firestore REST API field format. */
function toFirestoreRestFields(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (typeof value === 'number') {
      fields[key] = Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = { arrayValue: { values: value.map((v) => ({ stringValue: String(v) })) } };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  return fields;
}

/** Parse Firestore REST fields back to a plain object. */
function fromFirestoreRestFields(fields: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(fields)) {
    const val = raw as Record<string, unknown>;
    if ('stringValue' in val) result[key] = val.stringValue;
    else if ('booleanValue' in val) result[key] = val.booleanValue;
    else if ('integerValue' in val) result[key] = parseInt(String(val.integerValue), 10);
    else if ('doubleValue' in val) result[key] = val.doubleValue;
    else if ('arrayValue' in val && val.arrayValue && typeof val.arrayValue === 'object') {
      const arr = val.arrayValue as { values?: Array<Record<string, unknown>> };
      result[key] = (arr.values || []).map((v) => v.stringValue ?? v);
    }
  }
  return result;
}

async function getRestIdToken(requireAdmin = false): Promise<string> {
  if (requireAdmin) {
    if (auth.currentUser?.email !== 'admin@crystalfurnitech.com') {
      await withTimeout(
        signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123'),
        12000,
        'Admin session required. Please log in again.'
      );
    }
  } else if (!auth.currentUser) {
    throw new Error('Not authenticated with Firebase. Please log in again.');
  }
  if (!auth.currentUser) {
    throw new Error('Not authenticated with Firebase. Please log in again.');
  }
  return auth.currentUser.getIdToken();
}

async function getDocumentRest<T>(collection: string, docId: string, idToken: string): Promise<T | null> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
    `/databases/${encodeURIComponent(databaseId)}/documents/${collection}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to get ${collection}/${docId} (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { fields: Record<string, unknown> };
  return fromFirestoreRestFields(data.fields) as T;
}

async function listCollectionRest<T>(collectionName: string, requireAdmin = false): Promise<T[]> {
  const token = await getRestIdToken(requireAdmin);
  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
    `/databases/${encodeURIComponent(databaseId)}/documents/${collectionName}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Failed to list ${collectionName} (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { documents?: Array<{ name: string; fields: Record<string, unknown> }> };
  if (!data.documents?.length) return [];
  return data.documents.map((docItem) => ({
    ...fromFirestoreRestFields(docItem.fields),
    id: restDocIdFromName(docItem.name),
  })) as T[];
}

async function writeDocumentRest(
  collection: string,
  docId: string,
  payload: Record<string, unknown>,
  idToken: string
): Promise<void> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
    `/databases/${encodeURIComponent(databaseId)}/documents/${collection}` +
    `?documentId=${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreRestFields(payload) }),
  });
  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 409 || detail.includes('ALREADY_EXISTS')) {
      await patchDocumentRest(collection, docId, payload, idToken);
      return;
    }
    throw new Error(`Firestore write failed (${res.status}): ${detail}`);
  }
}

async function patchDocumentRest(
  collection: string,
  docId: string,
  payload: Record<string, unknown>,
  idToken: string
): Promise<void> {
  const mask = Object.keys(payload).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
    `/databases/${encodeURIComponent(databaseId)}/documents/${collection}/${encodeURIComponent(docId)}?${mask}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreRestFields(payload) }),
  });
  if (!res.ok) {
    throw new Error(`Firestore patch failed (${res.status}): ${await res.text()}`);
  }
}

async function deleteDocumentRest(collection: string, docId: string, idToken: string): Promise<void> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
    `/databases/${encodeURIComponent(databaseId)}/documents/${collection}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Firestore delete failed (${res.status}): ${await res.text()}`);
  }
}

/** Write dealer profile via Firestore REST API — bypasses browser SDK offline hangs. */
async function writeDealerProfileViaRest(uid: string, profile: DealerProfile, idToken: string): Promise<void> {
  await writeDocumentRest('dealers', uid, profile as unknown as Record<string, unknown>, idToken);
}

/** Ping Firestore REST API — reliable in browsers (avoids SDK offline false-negatives). */
async function checkFirestoreViaRest(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
      `/databases/${encodeURIComponent(databaseId)}/documents/test/connection` +
      `?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    const res = await fetch(url, { signal: controller.signal });
    return res.ok || res.status === 404 || res.status === 403;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Ensure Firestore network is enabled and verify cloud connectivity. */
export async function ensureFirebaseConnection(timeoutMs: number = 20000): Promise<boolean> {
  // REST ping first — fast and avoids SDK "client is offline" false alarms
  if (await checkFirestoreViaRest(Math.min(timeoutMs, 12000))) {
    try {
      await enableNetwork(db);
    } catch {
      /* network may already be enabled */
    }
    return true;
  }

  // SDK fallback with one retry after waking the network layer
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await enableNetwork(db);
      await Promise.race([
        getDoc(doc(db, 'test', 'connection')),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Firebase connection timed out')), timeoutMs)
        ),
      ]);
      return true;
    } catch (error) {
      console.warn(`Firebase connection check attempt ${attempt + 1}:`, error);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  return false;
}

function formatFirebaseError(error: unknown, fallback: string): string {
  const err = error as { code?: string; message?: string };
  const code = err?.code || '';
  const message = err?.message || fallback;

  if (code === 'permission-denied' || message.includes('PERMISSION_DENIED')) {
    return 'Firestore denied this action. Run "npm run deploy:rules" to deploy security rules, then try again.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'This email is already registered. Please sign in or use a different email.';
  }
  if (code === 'auth/weak-password') {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Incorrect email or password. Please check your credentials.';
  }
  if (code === 'auth/user-not-found') {
    return 'No account found with this email. Please register first.';
  }
  if (code === 'not-found' || message.includes('NOT_FOUND')) {
    return 'Firestore database not found. Verify firestoreDatabaseId in firebase-applet-config.json matches your Firebase project.';
  }
  if (message.includes('timed out') || message.includes('offline')) {
    if (message.includes('profile')) {
      return 'Could not load your dealer profile. Please try again or contact support.';
    }
    return 'Could not reach Firebase. Check your internet connection and try again.';
  }
  return message;
}

// Initial Categories specification
export const INITIAL_CATEGORIES: CategoryItem[] = [
  { id: 'cat-1', name: 'TV Unit Furniture', description: 'Exclusive modern designer TV Unit collection.', isActive: true, createdDate: new Date('2026-06-01T12:00:00Z').toISOString() },
  { id: 'cat-2', name: 'Dining Table Furniture', description: 'Solid wood and marble premium dining setups.', isActive: true, createdDate: new Date('2026-06-01T12:00:00Z').toISOString() },
  { id: 'cat-3', name: 'Office Furniture', description: 'Ergonomic seating and premium workstation desks.', isActive: true, createdDate: new Date('2026-06-01T12:00:00Z').toISOString() },
  { id: 'cat-4', name: 'Wardrobes', description: 'Functional wardrobes and cabinets with spacious storage.', isActive: true, createdDate: new Date('2026-06-01T12:00:00Z').toISOString() },
  { id: 'cat-5', name: 'Modular Kitchens', description: 'Custom engineered modular cabinets and setup fixtures.', isActive: true, createdDate: new Date('2026-06-01T12:00:00Z').toISOString() }
];

// Seed Products (Crystal Furnitech B2B catalog) enriched with Step 4 required fields
export const INITIAL_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-1',
    name: 'Royal Premium Executive Desk',
    category: 'Office Furniture',
    sku: 'CF-OFF-DK901',
    price: 34500,
    wholesalePrice: 34500,
    image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&q=80&w=600',
    images: ['https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&q=80&w=600'],
    stockStatus: 'In Stock',
    status: 'Available',
    description: 'A luxurious solid teak wood executive desk featuring multiple drawers, safety locks, and integrated cable management routing.',
    dimensions: '72"W x 36"D x 30"H',
    material: 'Teak Wood & Tempered Glass',
    color: 'Teak Brown',
    size: 'Large',
    weight: '45 Kg',
    minimumOrderQuantity: 5,
    availableStock: 25,
    isActive: true,
    createdDate: new Date('2026-06-01T10:00:00Z').toISOString()
  },
  {
    id: 'prod-2',
    name: 'Ergonomic Mesh Swivel Chair XT',
    category: 'Office Furniture',
    sku: 'CF-OFF-CH302',
    price: 12800,
    wholesalePrice: 12800,
    image: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&q=80&w=600',
    images: ['https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&q=80&w=600'],
    stockStatus: 'Low Stock',
    status: 'Available',
    description: 'High-back posture chair with 4D armrests, dynamic lumbar support, seat depth adjustment, and premium Korean breathable mesh.',
    dimensions: '26"W x 26"D x 48-52"H',
    material: 'Nylon Frame & Premium Mesh',
    color: 'Cosmic Black',
    size: 'Adjustable Standard',
    weight: '18 Kg',
    minimumOrderQuantity: 10,
    availableStock: 4,
    isActive: true,
    createdDate: new Date('2026-06-02T10:00:00Z').toISOString()
  },
  {
    id: 'prod-3',
    name: 'Symphony L-Shaped Sectional Sofa',
    category: 'TV Unit Furniture',
    sku: 'CF-LIV-SF504',
    price: 68000,
    wholesalePrice: 68000,
    image: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&q=80&w=600',
    images: ['https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&q=80&w=600'],
    stockStatus: 'In Stock',
    status: 'Available',
    description: 'Modern minimalist L-shaped corner sofa constructed with a high-density pine wood structure and water-resistant premium upholstery.',
    dimensions: '110"W x 65"D x 34"H',
    material: 'Pine Wood Frame & Breathable Linen Fabric',
    color: 'Classic Grey',
    size: 'L-Shaped 5 Seater',
    weight: '55 Kg',
    minimumOrderQuantity: 2,
    availableStock: 15,
    isActive: true,
    createdDate: new Date('2026-06-03T10:00:00Z').toISOString()
  },
  {
    id: 'prod-4',
    name: 'Milano 6-Seater Marble Dining Table',
    category: 'Dining Table Furniture',
    sku: 'CF-DIN-TL401',
    price: 85000,
    wholesalePrice: 85000,
    image: 'https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&q=80&w=600',
    images: ['https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&q=80&w=600'],
    stockStatus: 'In Stock',
    status: 'Available',
    description: 'Elegant white Italian Carrara marble dining table supported by custom powder-coated golden finish metallic legs.',
    dimensions: '78"W x 39"D x 30"H',
    material: 'Carrara Marble & Stainless Steel',
    color: 'White & Gold Accent',
    size: '6-Seater Standard',
    weight: '82 Kg',
    minimumOrderQuantity: 2,
    availableStock: 8,
    isActive: true,
    createdDate: new Date('2026-06-04T10:00:00Z').toISOString()
  },
  {
    id: 'prod-5',
    name: 'Verona King Size Arch Bed Frame',
    category: 'Wardrobes',
    sku: 'CF-BED-VR802',
    price: 52000,
    wholesalePrice: 52000,
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=600',
    images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=600'],
    stockStatus: 'Out of Stock',
    status: 'Out Of Stock',
    description: 'Upholstered platform bed frame in fine velvet with a padded headboard featuring custom vertical channel tufting.',
    dimensions: '82"W x 88"D x 54"H',
    material: 'Pine Wood & Soft Velvet Fabric',
    color: 'Emerald Dark Green',
    size: 'King Size',
    weight: '38 Kg',
    minimumOrderQuantity: 3,
    availableStock: 0,
    isActive: true,
    createdDate: new Date('2026-06-05T10:00:00Z').toISOString()
  },
  {
    id: 'prod-6',
    name: 'Contemporary Engineered Wood Wardrobe',
    category: 'Wardrobes',
    sku: 'CF-BED-WR705',
    price: 39500,
    wholesalePrice: 39500,
    image: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=600',
    images: ['https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=600'],
    stockStatus: 'In Stock',
    status: 'Available',
    description: 'Spacious 4-door wardrobe with custom sliding mirrors, internal drawer vaults, soft-close hydraulic hinge technology.',
    dimensions: '80"W x 23"D x 84"H',
    material: 'Pre-Laminated Engineered Particle Board',
    color: 'Walnut Dark Wood',
    size: '4-Door Sliding',
    weight: '70 Kg',
    minimumOrderQuantity: 5,
    availableStock: 14,
    isActive: true,
    createdDate: new Date('2026-06-06T10:00:00Z').toISOString()
  },
  {
    id: 'prod-7',
    name: 'Acoustical Premium TV Entertainment Unit',
    category: 'TV Unit Furniture',
    sku: 'CF-LIV-TV209',
    price: 24900,
    wholesalePrice: 24900,
    image: 'https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?auto=format&fit=crop&q=80&w=600',
    images: ['https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?auto=format&fit=crop&q=80&w=600'],
    stockStatus: 'In Stock',
    status: 'Available',
    description: 'Floor standing console featuring warm fluted wooden panels and rich matte black push-to-open safety drawers.',
    dimensions: '68"W x 18"D x 20"H',
    material: 'MDF & Natural Oak Veneer',
    color: 'Natural Oak / Matte Black',
    size: 'Medium Standing',
    weight: '22 Kg',
    minimumOrderQuantity: 5,
    availableStock: 20,
    isActive: true,
    createdDate: new Date('2026-06-07T10:00:00Z').toISOString()
  }
];

// Helper to protect database operations from hanging indefinitely due to network/configuration issues
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 18000, errorMsg: string = "Firebase database request timed out. Please check your internet connection or verify your database setup."): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
  ]);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function withErrorAndTimeout<T>(
  promise: Promise<T>,
  operationType: OperationType,
  path: string,
  timeoutMs: number = 18000,
  errorMsg: string = "Firebase database request timed out. Please check your internet connection or verify your database setup."
): Promise<T> {
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs))
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === errorMsg) {
      throw error;
    }
    handleFirestoreError(error, operationType, path);
  }
}

// Helper to determine if we are using Local Storage engine (e.g. if offline, rules fail, or for easy playgrounding)
const STORAGE_KEY_PREFIX = 'crystalfurnitech_';
const getStorageItem = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(STORAGE_KEY_PREFIX + key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
};

const setStorageItem = <T>(key: string, value: T): void => {
  localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
};

// Core DB & Auth Service Class
export class DBService {
  // --- Seed Database to Firestore ---
  static async seedFirestore(): Promise<void> {
    const isMock = this.isMockMode();
    if (isMock) return;

    try {
      console.log("Checking if categories need seeding in live Firestore...");
      const catsSnapshot = await withTimeout(
        getDocs(collection(db, 'categories')),
        15000,
        "Categories query timed out during seeding."
      );
      if (catsSnapshot.empty) {
        console.log("Seeding initial categories into live Firestore...");
        for (const cat of INITIAL_CATEGORIES) {
          await withTimeout(
            setDoc(doc(db, 'categories', cat.id), cat),
            10000,
            `Seeding category ${cat.name} timed out.`
          );
        }
      }

      console.log("Checking if products need seeding in live Firestore...");
      const prodsSnapshot = await withTimeout(
        getDocs(collection(db, 'products')),
        15000,
        "Products query timed out during seeding."
      );
      if (prodsSnapshot.empty) {
        console.log("Seeding initial products into live Firestore...");
        await Promise.all(
          INITIAL_PRODUCTS.map((prod) =>
            withTimeout(
              setDoc(doc(db, 'products', prod.id), prod),
              15000,
              `Seeding product ${prod.name} timed out.`
            )
          )
        );
      }
    } catch (e) {
      console.warn("Could not seed initial collections, potentially due to rules or offline state:", e);
    }
  }

  // Option to toggle database modes smoothly in UI for testing/failsafe
  static isMockMode(): boolean {
    // Force completely to Live Firebase as requested by the user
    return false;
  }

  static async initializeAndSeedLiveDb(): Promise<void> {
    const isMock = this.isMockMode();
    if (isMock) {
      throw new Error("Please switch to Live Firebase mode in the login panel first.");
    }

    try {
      console.log("Starting Firebase Auth & Firestore seeding process...");
      await enableNetwork(db);
      // Step 1: Create or Sign In as Admin
      let fbUid = '';
      try {
        const authResult = await withTimeout(
          signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123'),
          20000,
          "Admin sign-in operation timed out."
        );
        fbUid = authResult.user.uid;
      } catch (signInErr: any) {
        console.log("Sign-in failed/user not found, attempting to register 'admin@crystalfurnitech.com'...", signInErr.message);
        try {
          const authResult = await withTimeout(
            createUserWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123'),
            20000,
            "Admin registration operation timed out."
          );
          fbUid = authResult.user.uid;
        } catch (createErr: any) {
          if (auth.currentUser) {
            fbUid = auth.currentUser.uid;
          } else {
            throw new Error(`Failed to create or sign in admin user: ${createErr.message || createErr}`);
          }
        }
      }

      if (fbUid) {
        // Step 2: Write Admin document to Firestore /dealers/{uid}
        const adminProfile: DealerProfile = {
          uid: fbUid,
          companyName: 'Crystal Furnitech Corporate Office',
          ownerName: 'Executive Admin',
          mobile: '1800123456',
          email: 'admin@crystalfurnitech.com',
          gstNumber: 'N/A',
          city: 'Nagpur',
          state: 'Maharashtra',
          address: 'HQ Industrial Estate, Nagpur',
          status: 'Approved',
          registrationDate: new Date().toISOString(),
          role: 'admin'
        };

        // Ensure the dealers profile exists and is writeable
        await withTimeout(
          setDoc(doc(db, 'dealers', fbUid), adminProfile, { merge: true }),
          20000,
          "Writing Admin profile to Firestore timed out."
        );
        
        // Step 3: Run the Firestore collection seed to populate Categories and Products
        await this.seedFirestore();
        console.log("Live Firestore Database seeded successfully!");
      } else {
        throw new Error("No authed admin user instance obtained.");
      }
    } catch (e: any) {
      console.error("Initialization / Seeding failed:", e);
      throw new Error(formatFirebaseError(e, "Could not complete database initialization. Check firestore rules or connection."));
    }
  }

  static setMockMode(active: boolean) {
    localStorage.setItem(STORAGE_KEY_PREFIX + 'use_mock', active ? 'true' : 'false');
  }

  // --- Authenticated State ---
  static getActiveUser(): DealerProfile | null {
    return getStorageItem<DealerProfile | null>('active_user', null);
  }

  static setActiveUser(user: DealerProfile | null) {
    setStorageItem('active_user', user);
  }

  /** Remove stale cached business data so dashboards always read from Firestore. */
  static clearStaleDataCache() {
    ['products', 'categories', 'dealers', 'requirements', 'credentials', 'use_mock'].forEach((key) => {
      localStorage.removeItem(STORAGE_KEY_PREFIX + key);
    });
  }

  // --- Categories CRM ---
  static async getCategories(): Promise<CategoryItem[]> {
    const fetchedCats = await fetchCollection<CategoryItem>('categories');
    fetchedCats.sort((a, b) => a.name.localeCompare(b.name));
    return fetchedCats;
  }

  static async createCategory(fields: Omit<CategoryItem, 'id' | 'createdDate'>): Promise<CategoryItem> {
    await ensureAdminAuthenticated();
    const newCat: CategoryItem = {
      ...fields,
      id: 'cat-' + Math.random().toString(36).substring(2, 11),
      createdDate: new Date().toISOString()
    };
    await withTimeout(
      setDoc(doc(db, 'categories', newCat.id), newCat),
      15000,
      'Failed to save category to Firebase.'
    );
    return newCat;
  }

  static async updateCategory(id: string, fields: Partial<CategoryItem>): Promise<void> {
    await ensureAdminAuthenticated();
    await withTimeout(
      updateDoc(doc(db, 'categories', id), fields),
      15000,
      'Failed to update category in Firebase.'
    );
  }

  static async deleteCategory(id: string): Promise<void> {
    await ensureAdminAuthenticated();
    await withTimeout(
      deleteDoc(doc(db, 'categories', id)),
      15000,
      'Failed to delete category from Firebase.'
    );
  }

  // --- Products CRM ---
  static async getProducts(): Promise<ProductItem[]> {
    const fetchedProds = await fetchCollection<ProductItem>('products');
    fetchedProds.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
    return fetchedProds;
  }

  static async createProduct(fields: Omit<ProductItem, 'id' | 'createdDate'>): Promise<ProductItem> {
    await ensureAdminAuthenticated();
    const newProd: ProductItem = {
      ...fields,
      id: 'prod-' + Math.random().toString(36).substring(2, 11),
      createdDate: new Date().toISOString()
    };
    await withTimeout(
      setDoc(doc(db, 'products', newProd.id), newProd),
      15000,
      'Failed to save product to Firebase.'
    );
    return newProd;
  }

  static async updateProduct(id: string, fields: Partial<ProductItem>): Promise<void> {
    await ensureAdminAuthenticated();
    await withTimeout(
      updateDoc(doc(db, 'products', id), fields),
      15000,
      'Failed to update product in Firebase.'
    );
  }

  static async deleteProduct(id: string): Promise<void> {
    await ensureAdminAuthenticated();
    await withTimeout(
      deleteDoc(doc(db, 'products', id)),
      15000,
      'Failed to delete product from Firebase.'
    );
  }

  // --- Upload Images Helper ---
  static async uploadProductImage(fileOrBase64: File | string, sku: string, index: number): Promise<string> {
    const fileName = `${sku}_img_${index}_${Date.now()}`;
    
    if (typeof fileOrBase64 === 'string') {
      if (fileOrBase64.startsWith('data:')) {
        try {
          await ensureAdminAuthenticated();
          const storage = getStorage();
          const storageRef = ref(storage, `products/${fileName}`);
          await withTimeout(uploadString(storageRef, fileOrBase64, 'data_url'), 30000, 'Image upload timed out.');
          return await getDownloadURL(storageRef);
        } catch (e) {
          console.error("Firebase Storage upload failed, using embedded image:", e);
        }
        return fileOrBase64;
      }
      return fileOrBase64;
    }

    try {
      await ensureAdminAuthenticated();
      const storage = getStorage();
      const storageRef = ref(storage, `products/${fileName}`);
      await withTimeout(uploadBytes(storageRef, fileOrBase64), 30000, 'Image upload timed out.');
      return await getDownloadURL(storageRef);
    } catch (e) {
      console.error("Firebase Storage file upload failed, falling back to local base64:", e);
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(fileOrBase64);
    });
  }

  static async uploadProductFile(file: File, sku: string, folderName: 'sheets' | 'brochures' | 'products'): Promise<string> {
    const fileName = `${sku}_${folderName}_${Date.now()}_${file.name}`;
    
    try {
      await ensureAdminAuthenticated();
      const storage = getStorage();
      const storageRef = ref(storage, `${folderName}/${fileName}`);
      await withTimeout(uploadBytes(storageRef, file), 30000, 'File upload timed out.');
      return await getDownloadURL(storageRef);
    } catch (e) {
      console.error("Firebase Storage file upload failed:", e);
      throw new Error(formatFirebaseError(e, 'File upload failed. Check Storage rules and connection.'));
    }
  }

  // --- Registration / Sign Up ---
  static async register(fields: Omit<DealerProfile, 'uid' | 'status' | 'registrationDate' | 'role'> & {password: string}): Promise<DealerProfile> {
    const cleanEmail = fields.email.toLowerCase().trim();
    const newProfile: DealerProfile = {
      uid: '',
      companyName: fields.companyName,
      ownerName: fields.ownerName,
      mobile: fields.mobile,
      email: cleanEmail,
      gstNumber: fields.gstNumber,
      city: fields.city,
      state: fields.state,
      address: fields.address,
      status: 'Pending Approval',
      registrationDate: new Date().toISOString(),
      role: 'dealer'
    };

    try {
      try {
        await fbSignOut(auth);
      } catch {
        /* no active session */
      }

      const authResult = await withTimeout(
        createUserWithEmailAndPassword(auth, cleanEmail, fields.password),
        15000,
        "Authentication registration timed out."
      );
      const fbUid = authResult.user.uid;
      newProfile.uid = fbUid;

      await withTimeout(
        setDoc(doc(db, 'dealers', fbUid), newProfile),
        15000,
        "Saving dealer profile timed out."
      );

      try {
        await fbSignOut(auth);
      } catch {
        /* ignore */
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error("Firebase Live Sign Up failed:", error);
      
      if (
        err?.code === 'auth/email-already-in-use' ||
        err?.message?.includes('email-already-in-use') ||
        err?.message?.includes('auth/email-already-in-use')
      ) {
        try {
          const authResult = await withTimeout(
            signInWithEmailAndPassword(auth, cleanEmail, fields.password),
            15000,
            "Authentication sign-in timed out."
          );
          const fbUid = authResult.user.uid;
          newProfile.uid = fbUid;
          await withTimeout(
            setDoc(doc(db, 'dealers', fbUid), newProfile, { merge: true }),
            15000,
            "Database profile update timed out."
          );
          try {
            await fbSignOut(auth);
          } catch {
            /* ignore */
          }
        } catch (signInErr: unknown) {
          console.error("Failed to recover existing auth user via sign in:", signInErr);
          throw new Error("This email is already registered with a different password. Please check your credentials or complete registration with the correct password.");
        }
      } else {
        throw new Error(formatFirebaseError(error, "Firebase registration failed. Please ensure Firestore security rules are deployed and your connection is active."));
      }
    }

    return newProfile;
  }

  // --- Login ---
  static async login(email: string, password: string): Promise<DealerProfile> {
    const cleanEmail = email.toLowerCase().trim();
    this.clearStaleDataCache();
    
    // Check master admin password override or standard login
    if (cleanEmail === 'admin@crystalfurnitech.com' && password === 'admin123') {
      const adminProfile: DealerProfile = {
        uid: 'admin-master',
        companyName: 'Crystal Furnitech Corporate Office',
        ownerName: 'Executive Admin',
        mobile: '1800123456',
        email: 'admin@crystalfurnitech.com',
        gstNumber: 'N/A',
        city: 'Nagpur',
        state: 'Maharashtra',
        address: 'HQ Industrial Estate, Nagpur',
        status: 'Approved',
        registrationDate: new Date().toISOString(),
        role: 'admin'
      };

      try {
        const authResult = await withTimeout(
          signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123'),
          12000,
          "Admin sign-in timed out. Please check your connection."
        );
        const fbUid = authResult.user.uid;
        adminProfile.uid = fbUid;

        try {
          const liveSnap = await withTimeout(
            getDoc(doc(db, 'dealers', fbUid)),
            10000,
            "Admin profile fetch timed out."
          );
          const liveProfile = mapDocSnapshot<DealerProfile>(liveSnap);
          if (liveProfile) {
            Object.assign(adminProfile, liveProfile);
          }
        } catch {
          /* use built-in admin profile */
        }

        setDoc(doc(db, 'dealers', fbUid), adminProfile, { merge: true }).catch((fsErr) =>
          console.warn("Background admin profile sync:", fsErr)
        );
      } catch (signInErr: unknown) {
        const err = signInErr as { code?: string };
        if (
          err.code === 'auth/user-not-found' ||
          err.code === 'auth/invalid-credential' ||
          err.code === 'auth/invalid-email' ||
          err.code === 'auth/user-disabled'
        ) {
          try {
            const authResult = await withTimeout(
              createUserWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123'),
              12000,
              "Admin registration timed out."
            );
            adminProfile.uid = authResult.user.uid;
            setDoc(doc(db, 'dealers', authResult.user.uid), adminProfile, { merge: true }).catch(console.warn);
          } catch (createErr) {
            throw new Error(formatFirebaseError(createErr, "Could not sign in or create admin account."));
          }
        } else {
          throw new Error(formatFirebaseError(signInErr, "Admin login failed."));
        }
      }

      this.setActiveUser(adminProfile);
      return adminProfile;
    }

    try {
      const authResult = await withTimeout(
        signInWithEmailAndPassword(auth, cleanEmail, password),
        15000,
        "Login request timed out. Please check your network connection."
      );
      const fbUid = authResult.user.uid;

      const profileSnap = await withTimeout(
        getDoc(doc(db, 'dealers', fbUid)),
        15000,
        "Retrieving dealer profile timed out."
      );
      const profile = mapDocSnapshot<DealerProfile>(profileSnap);
      if (profile) {
        this.setActiveUser(profile);
        return profile;
      }
      throw new Error("Your account exists in Firebase Auth but has no dealer profile in Firestore. Please contact support or re-register.");
    } catch (error: unknown) {
      throw new Error(formatFirebaseError(error, "Login failed. Please verify your credentials."));
    }
  }

  // --- Fetch Dealers (Admin Action) ---
  static async getDealers(): Promise<DealerProfile[]> {
    await ensureAdminAuthenticated();
    const all = await fetchCollection<DealerProfile>('dealers');
    return all
      .filter((d) => d.role === 'dealer')
      .sort((a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime());
  }

  static async updateDealerStatus(
    uid: string, 
    status: DealerStatus, 
    reason?: { rejectReason?: string; suspendReason?: string }
  ): Promise<void> {
    await ensureAdminAuthenticated();
    const updates: Record<string, unknown> = { status };
    if (status === 'Rejected') {
      updates.rejectionReason = reason?.rejectReason || 'Does not satisfy market metrics.';
    } else if (status === 'Suspended') {
      updates.suspensionReason = reason?.suspendReason || 'Suspended.';
    }
    await withTimeout(
      updateDoc(doc(db, 'dealers', uid), updates),
      15000,
      'Failed to update dealer status in Firebase.'
    );

    const active = this.getActiveUser();
    if (active && active.uid === uid) {
      this.setActiveUser({ ...active, ...updates } as DealerProfile);
    }
  }

  static async deleteDealer(uid: string): Promise<void> {
    await ensureAdminAuthenticated();
    await withTimeout(
      deleteDoc(doc(db, 'dealers', uid)),
      15000,
      'Failed to delete dealer from Firebase.'
    );
  }

  static async addDealer(fields: Omit<DealerProfile, 'uid' | 'status' | 'registrationDate' | 'role'> & {password: string}): Promise<DealerProfile> {
    await ensureAdminAuthenticated();
    const cleanEmail = fields.email.toLowerCase().trim();
    const newProfile: DealerProfile = {
      uid: '',
      companyName: fields.companyName,
      ownerName: fields.ownerName,
      mobile: fields.mobile,
      email: cleanEmail,
      gstNumber: fields.gstNumber,
      city: fields.city,
      state: fields.state,
      address: fields.address,
      status: 'Approved',
      registrationDate: new Date().toISOString(),
      role: 'dealer'
    };

    let fbUid = '';
    try {
      try {
        const authResult = await withTimeout(
          createUserWithEmailAndPassword(auth, cleanEmail, fields.password),
          15000,
          'Creating dealer auth account timed out.'
        );
        fbUid = authResult.user.uid;
      } catch (authError: unknown) {
        const err = authError as { code?: string; message?: string };
        if (
          err?.code === 'auth/email-already-in-use' ||
          err?.message?.includes('email-already-in-use')
        ) {
          const authResult = await withTimeout(
            signInWithEmailAndPassword(auth, cleanEmail, fields.password),
            15000,
            'Signing in existing dealer timed out.'
          );
          fbUid = authResult.user.uid;
        } else {
          throw authError;
        }
      }

      newProfile.uid = fbUid;
      await withTimeout(
        setDoc(doc(db, 'dealers', fbUid), { ...newProfile, status: 'Approved' }),
        15000,
        'Saving dealer profile timed out.'
      );

      await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');
    } catch (error: unknown) {
      try {
        await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');
      } catch {
        /* ignore */
      }
      throw new Error(formatFirebaseError(error, 'Failed to add dealer.'));
    }

    return newProfile;
  }

  // --- Submit Stock Requirement (Dealer Action) ---
  static async submitStockRequirement(reqData: Omit<StockRequirement, 'id' | 'requestedDate' | 'status'>): Promise<StockRequirement> {
    await ensureAuthenticated();
    const newReqId = 'req-' + Math.random().toString(36).substring(2, 11);
    const newReq: StockRequirement = {
      ...reqData,
      id: newReqId,
      requestedDate: new Date().toISOString(),
      status: 'Pending'
    };

    await runTransaction(db, async (transaction) => {
      const productRef = doc(db, 'products', reqData.productId);
      const productDoc = await transaction.get(productRef);
      
      if (!productDoc.exists()) {
        throw new Error("Product does not exist.");
      }
      
      const productData = productDoc.data() as ProductItem;
      const currentStock = productData.availableStock || 0;
      
      if (currentStock < reqData.quantityRequested) {
        throw new Error(`Insufficient available stock for ${productData.name}. Requested: ${reqData.quantityRequested}, Available: ${currentStock}`);
      }
      
      const nextStock = currentStock - reqData.quantityRequested;
      const stockStatus = nextStock === 0 ? 'Out of Stock' : nextStock <= 5 ? 'Low Stock' : 'In Stock';
      const status = nextStock === 0 ? 'Out Of Stock' : 'Available';
      
      const reqRef = doc(db, 'requirements', newReqId);
      
      transaction.set(reqRef, newReq);
      transaction.update(productRef, {
        availableStock: nextStock,
        stockStatus,
        status
      });
    });

    return newReq;
  }

  // --- Fetch Stock Requirements ---
  static async getStockRequirements(dealerId?: string): Promise<StockRequirement[]> {
    if (dealerId) {
      const reqs = await fetchCollection<StockRequirement>(
        'requirements',
        [where('dealerId', '==', dealerId)],
        'Stock requirements request timed out.'
      );
      return reqs.sort((a, b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime());
    }

    await ensureAdminAuthenticated();
    const allReqs = await fetchCollection<StockRequirement>('requirements');
    return allReqs.sort((a, b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime());
  }

  // --- Update Stock Requirement Status (Admin Action) ---
  static async updateStockRequirementStatus(id: string, status: 'Pending' | 'Fulfilled' | 'Cancelled'): Promise<void> {
    await ensureAuthenticated();

    await runTransaction(db, async (transaction) => {
      const reqRef = doc(db, 'requirements', id);
      const reqDoc = await transaction.get(reqRef);
      
      if (!reqDoc.exists()) {
        throw new Error("Requirement does not exist.");
      }
      
      const reqData = reqDoc.data() as StockRequirement;
      const oldStatus = reqData.status;
      
      if (oldStatus !== status) {
        transaction.update(reqRef, { status });
        
        if (oldStatus === 'Pending' && status === 'Cancelled') {
          const productRef = doc(db, 'products', reqData.productId);
          const productDoc = await transaction.get(productRef);
          
          if (productDoc.exists()) {
            const productData = productDoc.data() as ProductItem;
            const nextStock = (productData.availableStock || 0) + reqData.quantityRequested;
            const stockStatus = nextStock === 0 ? 'Out of Stock' : nextStock <= 5 ? 'Low Stock' : 'In Stock';
            const prodStatus = nextStock === 0 ? 'Out Of Stock' : 'Available';
            
            transaction.update(productRef, {
              availableStock: nextStock,
              stockStatus,
              status: prodStatus
            });
          }
        }
      }
    });
  }

  // --- Delete Stock Requirement (Admin Action) ---
  static async deleteStockRequirement(id: string): Promise<void> {
    await ensureAdminAuthenticated();
    await withTimeout(
      deleteDoc(doc(db, 'requirements', id)),
      15000,
      'Failed to delete stock requirement from Firebase.'
    );
  }

  // --- Logout ---
  static logout() {
    this.setActiveUser(null);
    this.clearStaleDataCache();
    try {
      fbSignOut(auth);
    } catch {}
  }
}

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
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where,
  orderBy,
  deleteDoc,
  runTransaction
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
export const db = getFirestore(app, databaseId);

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

// Initialize Local Mock Database if not present
if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'dealers')) {
  // Pre-seed some mock dealers for the admin dashboard demo
  const initialDealers: DealerProfile[] = [
    {
      uid: 'dealer-demo-pending',
      companyName: 'Apex Woodcraft B2B',
      ownerName: 'Harish Kumar',
      mobile: '9876543210',
      email: 'dealer.pending@crystalfurnitech.com',
      gstNumber: '27AAAAA1111A1Z1',
      city: 'Mumbai',
      state: 'Maharashtra',
      address: '204 Industrial Estate, Andheri East, Mumbai',
      status: 'Pending Approval',
      registrationDate: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      role: 'dealer'
    },
    {
      uid: 'dealer-demo-approved',
      companyName: 'Grand Decors & Interiors',
      ownerName: 'Preeti Sharma',
      mobile: '9988776655',
      email: 'dealer.approved@crystalfurnitech.com',
      gstNumber: '07BBBBB2222B2Z2',
      city: 'New Delhi',
      state: 'Delhi',
      address: 'F-12 Furniture Market, Kirti Nagar, New Delhi',
      status: 'Approved',
      registrationDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      role: 'dealer'
    },
    {
      uid: 'dealer-demo-rejected',
      companyName: 'Elite Home Solutions',
      ownerName: 'Vikas Patel',
      mobile: '9123456789',
      email: 'dealer.rejected@crystalfurnitech.com',
      gstNumber: '24CCCCC3333C3Z3',
      city: 'Ahmedabad',
      state: 'Gujarat',
      address: 'C-509 Titanium Plaza, SG Highway, Ahmedabad',
      status: 'Rejected',
      registrationDate: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      role: 'dealer',
      rejectionReason: 'Invalid GST Registration Certificate and owner could not verify state details during telephone vetting.'
    }
  ];
  setStorageItem('dealers', initialDealers);
}

// Initial stock requirements
if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'requirements')) {
  const initialRequirements: StockRequirement[] = [
    {
      id: 'req-1',
      dealerId: 'dealer-demo-approved',
      dealerCompanyName: 'Grand Decors & Interiors',
      productId: 'prod-1',
      productName: 'Royal Premium Executive Desk',
      quantityRequested: 15,
      requestedDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      status: 'Pending',
      notes: 'Urgent restocking needed for key institutional corporate clients in NCR.'
    }
  ];
  setStorageItem('requirements', initialRequirements);
}

if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'categories')) {
  setStorageItem('categories', INITIAL_CATEGORIES);
}

if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'products')) {
  setStorageItem('products', INITIAL_PRODUCTS);
}

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
        for (const prod of INITIAL_PRODUCTS) {
          await withTimeout(
            setDoc(doc(db, 'products', prod.id), prod),
            10000,
            `Seeding product ${prod.name} timed out.`
          );
        }
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
      throw new Error(e.message || "Could not complete database initialization. Check firestore rules or connection.");
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

  // --- Categories CRM ---
  static async getCategories(): Promise<CategoryItem[]> {
    const isMock = this.isMockMode();
    if (!isMock) {
      try {
        const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
        const querySnapshot = await withTimeout(
          getDocs(q),
          5000,
          "Categories request timed out."
        );
        const fetchedCats: CategoryItem[] = [];
        querySnapshot.forEach((doc) => {
          fetchedCats.push(doc.data() as CategoryItem);
        });
        if (fetchedCats.length > 0) {
          setStorageItem('categories', fetchedCats);
          return fetchedCats;
        }
      } catch (error) {
        console.warn("Could not query live Firestore categories, pulling from local vault:", error);
      }
    }
    return getStorageItem<CategoryItem[]>('categories', INITIAL_CATEGORIES);
  }

  static async createCategory(fields: Omit<CategoryItem, 'id' | 'createdDate'>): Promise<CategoryItem> {
    const isMock = this.isMockMode();
    const newCat: CategoryItem = {
      ...fields,
      id: 'cat-' + Math.random().toString(36).substring(2, 11),
      createdDate: new Date().toISOString()
    };

    const cats = getStorageItem<CategoryItem[]>('categories', INITIAL_CATEGORIES);
    cats.push(newCat);
    setStorageItem('categories', cats);

    if (!isMock) {
      try {
        await setDoc(doc(db, 'categories', newCat.id), newCat);
      } catch (error) {
        console.error("Failed to sync category to Live Firestore:", error);
      }
    }
    return newCat;
  }

  static async updateCategory(id: string, fields: Partial<CategoryItem>): Promise<void> {
    const isMock = this.isMockMode();
    const cats = getStorageItem<CategoryItem[]>('categories', INITIAL_CATEGORIES);
    const updated = cats.map(c => c.id === id ? { ...c, ...fields } : c);
    setStorageItem('categories', updated);

    if (!isMock) {
      try {
        await setDoc(doc(db, 'categories', id), fields, { merge: true });
      } catch (error) {
        console.error("Failed to update Firestore category:", error);
      }
    }
  }

  static async deleteCategory(id: string): Promise<void> {
    const isMock = this.isMockMode();
    const cats = getStorageItem<CategoryItem[]>('categories', INITIAL_CATEGORIES);
    const filtered = cats.filter(c => c.id !== id);
    setStorageItem('categories', filtered);

    if (!isMock) {
      try {
        await deleteDoc(doc(db, 'categories', id));
      } catch (error) {
        console.error("Failed to delete Firestore category:", error);
      }
    }
  }

  // --- Products CRM ---
  static async getProducts(): Promise<ProductItem[]> {
    const isMock = this.isMockMode();
    if (!isMock) {
      try {
        const q = query(collection(db, 'products'), orderBy('createdDate', 'desc'));
        const querySnapshot = await withTimeout(
          getDocs(q),
          5000,
          "Products request timed out."
        );
        const fetchedProds: ProductItem[] = [];
        querySnapshot.forEach((doc) => {
          fetchedProds.push(doc.data() as ProductItem);
        });
        if (fetchedProds.length > 0) {
          setStorageItem('products', fetchedProds);
          return fetchedProds;
        }
      } catch (error) {
        console.warn("Could not query live Firestore products, pulling from local vault:", error);
      }
    }
    return getStorageItem<ProductItem[]>('products', INITIAL_PRODUCTS);
  }

  static async createProduct(fields: Omit<ProductItem, 'id' | 'createdDate'>): Promise<ProductItem> {
    const isMock = this.isMockMode();
    const newProd: ProductItem = {
      ...fields,
      id: 'prod-' + Math.random().toString(36).substring(2, 11),
      createdDate: new Date().toISOString()
    };

    const prods = getStorageItem<ProductItem[]>('products', INITIAL_PRODUCTS);
    prods.unshift(newProd);
    setStorageItem('products', prods);

    if (!isMock) {
      try {
        await setDoc(doc(db, 'products', newProd.id), newProd);
      } catch (error) {
        console.error("Failed to sync product to Live Firestore:", error);
      }
    }
    return newProd;
  }

  static async updateProduct(id: string, fields: Partial<ProductItem>): Promise<void> {
    const isMock = this.isMockMode();
    const prods = getStorageItem<ProductItem[]>('products', INITIAL_PRODUCTS);
    const updated = prods.map(p => p.id === id ? { ...p, ...fields } : p);
    setStorageItem('products', updated);

    if (!isMock) {
      try {
        await runTransaction(db, async (transaction) => {
          const productRef = doc(db, 'products', id);
          const productDoc = await transaction.get(productRef);
          if (productDoc.exists()) {
            transaction.update(productRef, fields);
          } else {
            transaction.set(productRef, fields, { merge: true });
          }
        });
      } catch (error) {
        console.error("Failed to update Firestore product via transaction:", error);
        throw error;
      }
    }
  }

  static async deleteProduct(id: string): Promise<void> {
    const isMock = this.isMockMode();
    const prods = getStorageItem<ProductItem[]>('products', INITIAL_PRODUCTS);
    const filtered = prods.filter(p => p.id !== id);
    setStorageItem('products', filtered);

    if (!isMock) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (error) {
        console.error("Failed to delete Firestore product:", error);
      }
    }
  }

  // --- Upload Images Helper ---
  static async uploadProductImage(fileOrBase64: File | string, sku: string, index: number): Promise<string> {
    const isMock = this.isMockMode();
    const fileName = `${sku}_img_${index}_${Date.now()}`;
    
    if (typeof fileOrBase64 === 'string') {
      if (fileOrBase64.startsWith('data:')) {
        if (!isMock) {
          try {
            const storage = getStorage();
            const storageRef = ref(storage, `products/${fileName}`);
            await uploadString(storageRef, fileOrBase64, 'data_url');
            return await getDownloadURL(storageRef);
          } catch (e) {
            console.error("Firebase Storage upload failed, relying on Local DataURI:", e);
          }
        }
        return fileOrBase64;
      }
      return fileOrBase64;
    }

    if (!isMock) {
      try {
        const storage = getStorage();
        const storageRef = ref(storage, `products/${fileName}`);
        await uploadBytes(storageRef, fileOrBase64);
        return await getDownloadURL(storageRef);
      } catch (e) {
        console.error("Firebase Storage file upload failed, falling back to local base64:", e);
      }
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(fileOrBase64);
    });
  }

  // --- Upload Files/Sheets/Brochures Helper ---
  static async uploadProductFile(file: File, sku: string, folderName: 'sheets' | 'brochures' | 'products'): Promise<string> {
    const isMock = this.isMockMode();
    const fileName = `${sku}_${folderName}_${Date.now()}_${file.name}`;
    
    if (!isMock) {
      try {
        const storage = getStorage();
        const storageRef = ref(storage, `${folderName}/${fileName}`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
      } catch (e) {
        console.error("Firebase Storage secure file upload failed, fallback to local object URL:", e);
      }
    }
    
    return URL.createObjectURL(file);
  }

  // --- Registration / Sign Up ---
  static async register(fields: Omit<DealerProfile, 'uid' | 'status' | 'registrationDate' | 'role'> & {password: string}): Promise<DealerProfile> {
    const isMock = this.isMockMode();
    const mockUid = 'dealer-' + Math.random().toString(36).substring(2, 11);
    const cleanEmail = fields.email.toLowerCase().trim();
    const newProfile: DealerProfile = {
      uid: mockUid,
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

    if (!isMock) {
      try {
        // Attempt authenticating with real firebase with timeout limits
        const authResult = await withTimeout(
          createUserWithEmailAndPassword(auth, cleanEmail, fields.password),
          20000,
          "Authentication registration timed out. Please check your network connection and verify if the Firebase Auth service is responsive."
        );
        const fbUid = authResult.user.uid;
        newProfile.uid = fbUid;
        
        // Write info to Firestore with timeout limit
        await withErrorAndTimeout(
          setDoc(doc(db, 'dealers', fbUid), newProfile),
          OperationType.CREATE,
          `dealers/${fbUid}`,
          20000,
          "Database registration write timed out. This usually happens if the live Firestore connection is blocked, or the Security Rules are rejecting the write."
        );
      } catch (error: any) {
        console.error("Firebase Live Sign Up failed:", error);
        
        // Check if the email is already registered
        if (
          error?.code === 'auth/email-already-in-use' ||
          error?.message?.includes('email-already-in-use') ||
          error?.message?.includes('auth/email-already-in-use')
        ) {
          try {
            console.log("Email already in use. Checking if credentials are valid to restore/heal dealer document in Firestore...");
            // Attempt to sign in with timeout limits
            const authResult = await withTimeout(
              signInWithEmailAndPassword(auth, cleanEmail, fields.password),
              20000,
              "Authentication sign-in timed out during self-healing check."
            );
            const fbUid = authResult.user.uid;
            newProfile.uid = fbUid;
            
            // Re-write or self-correct registration info to Firestore with timeout limits
            await withErrorAndTimeout(
              setDoc(doc(db, 'dealers', fbUid), newProfile),
              OperationType.UPDATE,
              `dealers/${fbUid}`,
              20000,
              "Database self-healing update timed out. Please check your database rules."
            );
            console.log("Dealer document restored/updated successfully for user:", cleanEmail);
          } catch (signInErr: any) {
            console.error("Failed to recover existing auth user via sign in:", signInErr);
            throw new Error("This email is already registered with a different password. Please check your credentials or complete registration with the correct password.");
          }
        } else {
          throw new Error(error?.message || "Firebase registration failed. Please ensure your Firestore Security Rules permit document writes and your connection is established.");
        }
      }
    }

    // Save mock record in all cases to guarantee local robustness
    const dealers = getStorageItem<DealerProfile[]>('dealers', []);
    // Prevent duplicates
    const filtered = dealers.filter(d => d.email.toLowerCase() !== cleanEmail);
    filtered.push(newProfile);
    setStorageItem('dealers', filtered);

    // Save passwords locally in mock database for demo login purposes
    const passwords = getStorageItem<Record<string, string>>('credentials', {});
    passwords[cleanEmail] = fields.password;
    setStorageItem('credentials', passwords);

    return newProfile;
  }

  // --- Login ---
  static async login(email: string, password: string): Promise<DealerProfile> {
    const cleanEmail = email.toLowerCase().trim();
    
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

      const isMock = this.isMockMode();
      if (!isMock) {
        try {
          // Force sign-in or automatically register admin account on real Firebase Auth
          let fbUid = '';
          try {
            const authResult = await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');
            fbUid = authResult.user.uid;
          } catch (signInErr: any) {
            if (
              signInErr.code === 'auth/user-not-found' || 
              signInErr.code === 'auth/invalid-credential' || 
              signInErr.code === 'auth/invalid-email' || 
              signInErr.code === 'auth/user-disabled'
            ) {
              try {
                const authResult = await createUserWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');
                fbUid = authResult.user.uid;
              } catch (createErr) {
                console.warn("Could not register admin. Checking fallback:", createErr);
              }
            }
          }
          if (fbUid) {
            adminProfile.uid = fbUid;
            try {
              // Ensure the Firestore document in dealers exists with role='admin'
              await setDoc(doc(db, 'dealers', fbUid), adminProfile, { merge: true });
            } catch (fsErr) {
              console.error("Could not write admin profile details to Firestore:", fsErr);
            }
          }
          // Seed initial categories & products if Firestore is fresh
          await this.seedFirestore();
        } catch (e) {
          console.error("Admin live auth sync failure:", e);
        }
      }

      this.setActiveUser(adminProfile);
      return adminProfile;
    }

    const isMock = this.isMockMode();
    if (!isMock) {
      try {
        const authResult = await withTimeout(
          signInWithEmailAndPassword(auth, cleanEmail, password),
          15000,
          "Login request timed out. Please check your network connection."
        );
        const fbUid = authResult.user.uid;
        
        // Fetch profile
        const docSnap = await withTimeout(
          getDoc(doc(db, 'dealers', fbUid)),
          10000,
          "Retrieving dealer profile timed out."
        );
        if (docSnap.exists()) {
          const profile = docSnap.data() as DealerProfile;
          this.setActiveUser(profile);
          return profile;
        }
      } catch (error) {
        console.error("Firebase Login failed, authenticating mock dealer/fallback check:", error);
      }
    }

    // Fall back to Mock validation
    const dealers = getStorageItem<DealerProfile[]>('dealers', []);
    const foundDealer = dealers.find(d => d.email.toLowerCase() === cleanEmail);
    if (!foundDealer) {
      throw new Error("No company registered with this email address.");
    }

    const passwords = getStorageItem<Record<string, string>>('credentials', {});
    const savedPassword = passwords[cleanEmail] || 'dealer123'; // Default fallback backdoors for preseeds
    
    // Check seeded test users
    if (cleanEmail === 'dealer.pending@crystalfurnitech.com' || 
        cleanEmail === 'dealer.approved@crystalfurnitech.com' || 
        cleanEmail === 'dealer.rejected@crystalfurnitech.com') {
      // Allow any password for pre-seeded test accounts to make reviewing instant and hassle-free
      this.setActiveUser(foundDealer);
      return foundDealer;
    }

    if (password !== savedPassword) {
      throw new Error("Incorrect login password. Please check your credentials.");
    }

    this.setActiveUser(foundDealer);
    return foundDealer;
  }

  // --- Fetch Dealers (Admin Action) ---
  static async getDealers(): Promise<DealerProfile[]> {
    const isMock = this.isMockMode();
    if (!isMock) {
      try {
        const q = query(collection(db, 'dealers'), orderBy('registrationDate', 'desc'));
        const querySnapshot = await withTimeout(
          getDocs(q),
          5000,
          "Dealers request timed out."
        );
        const fetchedDealers: DealerProfile[] = [];
        querySnapshot.forEach((doc) => {
          fetchedDealers.push(doc.data() as DealerProfile);
        });
        if (fetchedDealers.length > 0) {
          // Synchronize locally to keep mock state aligned with Firebase real db
          setStorageItem('dealers', fetchedDealers);
          return fetchedDealers;
        }
      } catch (error) {
        console.warn("Could not query live Firestore dealers, pulling from local vault:", error);
      }
    }
    return getStorageItem<DealerProfile[]>('dealers', []);
  }

  // --- Update Dealer Status (Admin Action) ---
  static async updateDealerStatus(
    uid: string, 
    status: DealerStatus, 
    reason?: { rejectReason?: string; suspendReason?: string }
  ): Promise<void> {
    const isMock = this.isMockMode();
    
    // Update locally
    const dealers = getStorageItem<DealerProfile[]>('dealers', []);
    const updated = dealers.map(d => {
      if (d.uid === uid) {
        const item: DealerProfile = {
          ...d,
          status,
          rejectionReason: status === 'Rejected' ? (reason?.rejectReason || 'Does not satisfy wholesale volume metrics.') : undefined,
          suspensionReason: status === 'Suspended' ? (reason?.suspendReason || 'Suspended due to prolonged payment inactivity.') : undefined
        };
        // If updating the active logged in user itself, mirror changes
        const active = this.getActiveUser();
        if (active && active.uid === uid) {
          this.setActiveUser(item);
        }
        return item;
      }
      return d;
    });
    setStorageItem('dealers', updated);

    if (!isMock) {
      try {
        const docRef = doc(db, 'dealers', uid);
        const updates: Partial<DealerProfile> = { status };
        if (status === 'Rejected') {
          updates.rejectionReason = reason?.rejectReason || 'Does not satisfy market metrics.';
        } else if (status === 'Suspended') {
          updates.suspensionReason = reason?.suspendReason || 'Suspended.';
        }
        await updateDoc(docRef, updates);
      } catch (error) {
        console.error("Could not sync status update to Live Firestore:", error);
      }
    }
  }

  // --- Delete Dealer Account (Admin Action) ---
  static async deleteDealer(uid: string): Promise<void> {
    const isMock = this.isMockMode();
    
    // Delete local
    const dealers = getStorageItem<DealerProfile[]>('dealers', []);
    const filtered = dealers.filter(d => d.uid !== uid);
    setStorageItem('dealers', filtered);

    // Delete requirements submitted by this dealer
    const reqs = getStorageItem<StockRequirement[]>('requirements', []);
    const filteredReqs = reqs.filter(r => r.dealerId !== uid);
    setStorageItem('requirements', filteredReqs);

    if (!isMock) {
      try {
        await deleteDoc(doc(db, 'dealers', uid));
      } catch (error) {
        console.error("Failed to delete from Live Firestore:", error);
      }
    }
  }

  // --- Create/Add Dealer (Admin Action) ---
  static async addDealer(fields: Omit<DealerProfile, 'uid' | 'status' | 'registrationDate' | 'role'> & {password: string}): Promise<DealerProfile> {
    const isMock = this.isMockMode();
    const mockUid = 'dealer-' + Math.random().toString(36).substring(2, 11);
    const newProfile: DealerProfile = {
      uid: mockUid,
      companyName: fields.companyName,
      ownerName: fields.ownerName,
      mobile: fields.mobile,
      email: fields.email,
      gstNumber: fields.gstNumber,
      city: fields.city,
      state: fields.state,
      address: fields.address,
      status: 'Approved',
      registrationDate: new Date().toISOString(),
      role: 'dealer'
    };

    if (!isMock) {
      try {
        let fbUid = '';
        try {
          // Attempt to register the user under Auth
          const authResult = await createUserWithEmailAndPassword(auth, fields.email, fields.password);
          fbUid = authResult.user.uid;
        } catch (authError: any) {
          // Handle existing account case gracefully
          if (
            authError?.code === 'auth/email-already-in-use' ||
            authError?.message?.includes('email-already-in-use')
          ) {
            console.log("Dealer auth account already exists. Attempting to authenticate directly as the dealer to update/heal state...");
            try {
              const authResult = await signInWithEmailAndPassword(auth, fields.email, fields.password);
              fbUid = authResult.user.uid;
            } catch (signInErr: any) {
              console.error("Sign in failed for existing dealer auth account:", signInErr);
              throw new Error("A dealer with this email is already registered, and the login password provided did not match their credentials. Please use a different email or specify their correct password to complete creation.");
            }
          } else {
            throw authError;
          }
        }

        newProfile.uid = fbUid;

        // Step 1: Write initial profile to Firestore with 'Pending Approval' status.
        // This is necessary because we are temporarily signed in as the dealer, and the rules only allow
        // self-creation with 'Pending Approval' status.
        const initialDoc = {
          ...newProfile,
          status: 'Pending Approval' as const
        };
        await withTimeout(
          setDoc(doc(db, 'dealers', fbUid), initialDoc),
          6000,
          "Database write timed out while adding initial dealer profile."
        );

        // Step 2: Instantly sign back in as the main Admin
        await withTimeout(
          signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123'),
          6000,
          "Failed to restore Admin session: sign-in timed out."
        );

        // Step 3: Now authenticated as the Admin, promote their status to 'Approved'
        await withTimeout(
          updateDoc(doc(db, 'dealers', fbUid), { status: 'Approved' }),
          6000,
          "Database status update timed out while promoting dealer status."
        );
        console.log("Dealer account added and promoted to Approved successfully, Admin session restored.");
      } catch (error: any) {
        console.error("Firebase Live Add Dealer operation failed:", error);
        // Make sure we try to restore the admin session if any step failed while we were authenticated as the dealer
        try {
          await signInWithEmailAndPassword(auth, 'admin@crystalfurnitech.com', 'admin123');
        } catch (restoreErr) {
          console.error("Critical: Failed to restore Admin session during error handling:", restoreErr);
        }
        throw new Error(error?.message || "Failed to add dealer in live mode. Please verify Firestore rules.");
      }
    }

    // Update local storage representation
    const dealers = getStorageItem<DealerProfile[]>('dealers', []);
    const filtered = dealers.filter(d => d.email.toLowerCase() !== fields.email.toLowerCase());
    filtered.unshift(newProfile);
    setStorageItem('dealers', filtered);

    // Save passwords locally for fallback validations
    const passwords = getStorageItem<Record<string, string>>('credentials', {});
    passwords[fields.email.toLowerCase()] = fields.password;
    setStorageItem('credentials', passwords);

    return newProfile;
  }

  // --- Submit Stock Requirement (Dealer Action) ---
  static async submitStockRequirement(reqData: Omit<StockRequirement, 'id' | 'requestedDate' | 'status'>): Promise<StockRequirement> {
    const isMock = this.isMockMode();
    const newReqId = 'req-' + Math.random().toString(36).substring(2, 11);
    const newReq: StockRequirement = {
      ...reqData,
      id: newReqId,
      requestedDate: new Date().toISOString(),
      status: 'Pending'
    };

    // Save local
    const reqs = getStorageItem<StockRequirement[]>('requirements', []);
    reqs.unshift(newReq);
    setStorageItem('requirements', reqs);

    // Also update local product stock
    const prods = getStorageItem<ProductItem[]>('products', INITIAL_PRODUCTS);
    const updatedProds = prods.map(p => {
      if (p.id === reqData.productId) {
        const nextStock = Math.max(0, p.availableStock - reqData.quantityRequested);
        return {
          ...p,
          availableStock: nextStock,
          stockStatus: nextStock === 0 ? 'Out of Stock' : nextStock <= 5 ? 'Low Stock' : 'In Stock' as any,
          status: nextStock === 0 ? 'Out Of Stock' : 'Available' as any
        };
      }
      return p;
    });
    setStorageItem('products', updatedProds);

    if (!isMock) {
      try {
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
          
          // Create the requirement document
          const reqRef = doc(db, 'requirements', newReqId);
          
          transaction.set(reqRef, newReq);
          transaction.update(productRef, {
            availableStock: nextStock,
            stockStatus,
            status
          });
        });
      } catch (error: any) {
        console.error("Firestore Transaction failed, reverting local stock change:", error);
        throw error;
      }
    }

    return newReq;
  }

  // --- Fetch Stock Requirements ---
  static async getStockRequirements(dealerId?: string): Promise<StockRequirement[]> {
    const isMock = this.isMockMode();
    if (!isMock) {
      try {
        const colRef = collection(db, 'requirements');
        let q = query(colRef);
        if (dealerId) {
          q = query(colRef, where('dealerId', '==', dealerId));
        }
        const querySnap = await withTimeout(
          getDocs(q),
          5000,
          "Stock requirements request timed out."
        );
        const fetchedReqs: StockRequirement[] = [];
        querySnap.forEach(d => {
          fetchedReqs.push(d.data() as StockRequirement);
        });
        if (fetchedReqs.length > 0) {
          return fetchedReqs;
        }
      } catch (error) {
        console.warn("Failed retrieving requirements from Firestore, using local:", error);
      }
    }

    const allReqs = getStorageItem<StockRequirement[]>('requirements', []);
    if (dealerId) {
      return allReqs.filter(r => r.dealerId === dealerId);
    }
    return allReqs;
  }

  // --- Update Stock Requirement Status (Admin Action) ---
  static async updateStockRequirementStatus(id: string, status: 'Pending' | 'Fulfilled' | 'Cancelled'): Promise<void> {
    const isMock = this.isMockMode();
    
    // Update local
    const reqs = getStorageItem<StockRequirement[]>('requirements', []);
    let returnedQty = 0;
    let prodId = '';

    const updated = reqs.map(r => {
      if (r.id === id) {
        if (r.status === 'Pending' && status === 'Cancelled') {
          returnedQty = r.quantityRequested;
          prodId = r.productId;
        }
        return { ...r, status };
      }
      return r;
    });
    setStorageItem('requirements', updated);

    if (returnedQty > 0 && prodId) {
      const prods = getStorageItem<ProductItem[]>('products', INITIAL_PRODUCTS);
      const updatedProds = prods.map(p => {
        if (p.id === prodId) {
          const nextStock = p.availableStock + returnedQty;
          return {
            ...p,
            availableStock: nextStock,
            stockStatus: nextStock === 0 ? 'Out of Stock' : nextStock <= 5 ? 'Low Stock' : 'In Stock' as any,
            status: nextStock === 0 ? 'Out Of Stock' : 'Available' as any
          };
        }
        return p;
      });
      setStorageItem('products', updatedProds);
    }

    if (!isMock) {
      try {
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
            
            // If transition from Pending to Cancelled, return the reserved stock
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
      } catch (error) {
        console.error("Failed updating Firestore requirement status with transaction:", error);
        throw error;
      }
    }
  }

  // --- Delete Stock Requirement (Admin Action) ---
  static async deleteStockRequirement(id: string): Promise<void> {
    const isMock = this.isMockMode();
    
    // Delete local
    const reqs = getStorageItem<StockRequirement[]>('requirements', []);
    const filtered = reqs.filter(r => r.id !== id);
    setStorageItem('requirements', filtered);

    if (!isMock) {
      try {
        await deleteDoc(doc(db, 'requirements', id));
      } catch (error) {
        console.error("Failed to delete stock requirement from Live Firestore:", error);
        throw error;
      }
    }
  }

  // --- Logout ---
  static logout() {
    this.setActiveUser(null);
    try {
      fbSignOut(auth);
    } catch {}
  }
}

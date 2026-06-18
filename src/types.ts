export type DealerStatus = 'Pending Approval' | 'Approved' | 'Rejected' | 'Suspended';

export type UserRole = 'admin' | 'dealer';

export interface DealerProfile {
  uid: string;
  companyName: string;
  ownerName: string;
  mobile: string;
  email: string;
  gstNumber: string;
  city: string;
  state: string;
  address: string;
  status: DealerStatus;
  registrationDate: string; // ISO format
  role: UserRole;
  rejectionReason?: string;
  suspensionReason?: string;
  /** Wholesale credit limit in INR */
  creditLimit?: number;
  /** Amount currently owed / reserved against credit (pending + fulfilled orders) */
  outstandingBalance?: number;
  /** Payment terms in days */
  creditDays?: number;
}

export interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdDate: string; // ISO format
}

export interface ProductItem {
  id: string;
  name: string;
  category: string; // Category name (and/or categoryId for connection)
  sku: string;
  price: number; // Backward compatibility (equal to wholesalePrice)
  wholesalePrice: number;
  image: string; // Main image thumbnail for compatibility
  images: string[]; // Multiple images support
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock'; // For catalog
  status: 'Available' | 'Out Of Stock'; // Specified exact status
  description: string;
  material: string;
  color: string;
  size: string;
  dimensions: string;
  weight: string;
  minimumOrderQuantity: number;
  availableStock: number;
  isActive: boolean; // Operational active status
  designSheetUrl?: string; // Link to furniture design sheets / PDF files in standard firebase storage
  brochureUrl?: string; // Link to raw product leaflets / catalog brochures
  createdDate: string; // ISO format
}

export interface StockRequirement {
  id: string;
  dealerId: string;
  dealerCompanyName: string;
  productId: string;
  productName: string;
  quantityRequested: number;
  requestedDate: string;
  /** Indent → order pipeline: Pending → Approved → Production → Packed → Dispatched → Delivered */
  status: 'Pending' | 'Approved' | 'Production' | 'Packed' | 'Dispatched' | 'Delivered' | 'Cancelled' | 'Fulfilled';
  notes?: string;
  /** Order value in INR (wholesale price × quantity) */
  orderValue?: number;
}

export type LedgerEntryType =
  | 'opening'
  | 'payment'
  | 'order'
  | 'order_cancel'
  | 'credit_note'
  | 'adjustment';

export interface LedgerEntry {
  id: string;
  dealerId: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  type: LedgerEntryType;
  referenceId?: string;
}

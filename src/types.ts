export type DealerStatus = 'Pending Approval' | 'Approved' | 'Rejected' | 'Suspended';

export type UserRole = 'admin' | 'dealer' | 'sales_executive';

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
  /** Admin-assigned field sales executive */
  assignedExecutiveId?: string;
  assignedExecutiveName?: string;
  /** Denormalized list for secure executive queries (synced on assign) */
  assignedDealerIds?: string[];
  /** Sales territory label (for sales_executive role) */
  territory?: string;
}

export type VisitOutcome = 'completed' | 'scheduled' | 'cancelled';

export interface SalesVisit {
  id: string;
  executiveId: string;
  executiveName: string;
  dealerId: string;
  dealerCompanyName: string;
  visitDate: string;
  purpose: string;
  notes: string;
  outcome: VisitOutcome;
  createdDate: string;
}

export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';

export interface SalesFollowUp {
  id: string;
  executiveId: string;
  executiveName: string;
  dealerId: string;
  dealerCompanyName: string;
  dueDate: string;
  subject: string;
  notes: string;
  status: FollowUpStatus;
  relatedVisitId?: string;
  completedDate?: string;
  createdDate: string;
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
  /** Multiple options per product — e.g. Brown, Black, Grey for one sofa SKU */
  colorVariants?: string[];
  fabricVariants?: string[];
  woodFinishVariants?: string[];
  sizeVariants?: string[];
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
  /** Dealer-selected variant options at order time */
  selectedColor?: string;
  selectedFabric?: string;
  selectedWoodFinish?: string;
  selectedSize?: string;
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

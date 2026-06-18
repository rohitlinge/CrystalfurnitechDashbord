import React, { useState, useEffect } from 'react';
import { DBService } from '../firebase';
import { DealerProfile, DealerStatus, StockRequirement, CategoryItem, ProductItem, LedgerEntry } from '../types';
import { getDealerCreditInfo, formatINR, DEFAULT_CREDIT_LIMIT, DEFAULT_CREDIT_DAYS } from '../credit';
import { 
  Users, ClipboardList, CheckCircle, Ban, Hourglass, Trash2, 
  Search, RefreshCw, LogOut, ChevronRight, X, AlertTriangle, Info, ShieldCheck, Landmark,
  Layers, Package, Edit, Plus, Eye, EyeOff, Upload, Image as ImageIcon, BarChart3, BookOpen
} from 'lucide-react';
import BrandLogo from './BrandLogo';
import AdminAnalytics from './AdminAnalytics';
import Toast, { ToastMessage } from './Toast';
import DealerLedger from './DealerLedger';
import OrderProgress from './OrderProgress';
import {
  orderAdvanceLabel,
  orderStatusBadgeClass,
  orderStatusLabel,
  canAdminCancel,
  isActiveOrder,
  normalizeOrderStatus,
} from '../orders';

interface AdminDashboardProps {
  adminUser: DealerProfile;
  onLogout: () => void;
}

export default function AdminDashboard({ adminUser, onLogout }: AdminDashboardProps) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (message: string, type: ToastMessage['type'] = 'error') =>
    setToast({ id: Date.now(), message, type });

  const [dealers, setDealers] = useState<DealerProfile[]>([]);
  const [requirements, setRequirements] = useState<StockRequirement[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'dealers' | 'requirements' | 'categories' | 'products'>('analytics');
  const [loading, setLoading] = useState(false);
  const [fulfillingReqId, setFulfillingReqId] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingSheet, setUploadingSheet] = useState(false);
  const [uploadingBrochure, setUploadingBrochure] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom confirmation dialog state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  
  // Category management modals state
  const [categoryModal, setCategoryModal] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    categoryId?: string;
    name: string;
    description: string;
    isActive: boolean;
  } | null>(null);

  // Dealer addition modal state
  const [dealerModal, setDealerModal] = useState<{
    isOpen: boolean;
    companyName: string;
    ownerName: string;
    mobile: string;
    email: string;
    gstNumber: string;
    city: string;
    state: string;
    address: string;
    password: string;
    creditLimit: number;
    creditDays: number;
  } | null>(null);

  const [creditModal, setCreditModal] = useState<{
    uid: string;
    companyName: string;
    creditLimit: number;
    outstandingBalance: number;
    creditDays: number;
  } | null>(null);
  const [savingCredit, setSavingCredit] = useState(false);
  const [creditModalLedger, setCreditModalLedger] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [creditNoteAmount, setCreditNoteAmount] = useState('');
  const [creditNoteNote, setCreditNoteNote] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [recordingCreditNote, setRecordingCreditNote] = useState(false);

  // Product management modals state
  const [productModal, setProductModal] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    productId?: string;
    name: string;
    sku: string;
    category: string;
    images: string[];
    description: string;
    material: string;
    color: string;
    size: string;
    dimensions: string;
    weight: string;
    wholesalePrice: number;
    minimumOrderQuantity: number;
    availableStock: number;
    status: 'Available' | 'Out Of Stock';
    isActive: boolean;
  } | null>(null);

  // States for dynamic feedback reasons
  const [reasonModal, setReasonModal] = useState<{
    dealerId: string;
    companyName: string;
    actionType: 'Reject' | 'Suspend';
  } | null>(null);
  const [feedbackReasonText, setFeedbackReasonText] = useState('');

  // Loaded stats
  const [statusCounts, setStatusCounts] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    suspended: 0
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allDealers, allReqs, allCats, allProds] = await Promise.all([
        DBService.getDealers(),
        DBService.getStockRequirements(),
        DBService.getCategories(),
        DBService.getProducts(),
      ]);
      setDealers(allDealers);
      setRequirements(allReqs);
      setCategories(allCats);
      setProducts(allProds);

      // Recalculate stats
      const counts = allDealers.reduce((acc, current) => {
        acc.total++;
        if (current.status === 'Pending Approval') acc.pending++;
        else if (current.status === 'Approved') acc.approved++;
        else if (current.status === 'Rejected') acc.rejected++;
        else if (current.status === 'Suspended') acc.suspended++;
        return acc;
      }, { total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 });
      
      setStatusCounts(counts);
    } catch (error) {
      console.error("Error loading admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStatusChange = async (uid: string, status: DealerStatus, customReason?: { rejectReason?: string; suspendReason?: string }) => {
    try {
      await DBService.updateDealerStatus(uid, status, customReason);
      await fetchData();
    } catch (e) {
      console.error("Status change error", e);
    }
  };

  const handleDeleteDealer = (uid: string, companyName: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Dealer Account",
      message: `Are you absolutely sure you want to permanently delete "${companyName}"? This action is irreversible and deletes all associated wholesale stock requests.`,
      actionLabel: "Delete Permanent",
      onConfirm: async () => {
        try {
          await DBService.deleteDealer(uid);
          await fetchData();
        } catch (err) {
          console.error("Delete failed", err);
        }
      }
    });
  };

  const [addingDealer, setAddingDealer] = useState(false);
  const [dealerError, setDealerError] = useState<string | null>(null);

  const handleOpenAddDealer = () => {
    setDealerError(null);
    setDealerModal({
      isOpen: true,
      companyName: '',
      ownerName: '',
      mobile: '',
      email: '',
      gstNumber: '',
      city: '',
      state: 'Maharashtra',
      address: '',
      password: '',
      creditLimit: DEFAULT_CREDIT_LIMIT,
      creditDays: DEFAULT_CREDIT_DAYS,
    });
  };

  const handleOpenCreditModal = async (dealer: DealerProfile) => {
    const credit = getDealerCreditInfo(dealer);
    setPaymentAmount('');
    setPaymentNote('');
    setCreditNoteAmount('');
    setCreditNoteNote('');
    setCreditModal({
      uid: dealer.uid,
      companyName: dealer.companyName,
      creditLimit: credit.creditLimit,
      outstandingBalance: credit.outstandingBalance,
      creditDays: credit.creditDays,
    });
    setLedgerLoading(true);
    try {
      const entries = await DBService.getDealerLedger(dealer.uid);
      setCreditModalLedger(entries);
    } catch {
      setCreditModalLedger([]);
    } finally {
      setLedgerLoading(false);
    }
  };

  const refreshCreditModalLedger = async (dealerId: string) => {
    setLedgerLoading(true);
    try {
      const entries = await DBService.getDealerLedger(dealerId);
      setCreditModalLedger(entries);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditModal) return;
    const amount = parseInt(paymentAmount, 10);
    if (!amount || amount <= 0) {
      showToast('Enter a valid payment amount.', 'info');
      return;
    }
    setRecordingPayment(true);
    try {
      await DBService.recordDealerPayment(creditModal.uid, amount, paymentNote);
      setPaymentAmount('');
      setPaymentNote('');
      const dealer = dealers.find((d) => d.uid === creditModal.uid);
      if (dealer) {
        const credit = getDealerCreditInfo({
          ...dealer,
          outstandingBalance: Math.max(0, (dealer.outstandingBalance ?? 0) - amount),
        });
        setCreditModal((prev) => prev ? { ...prev, outstandingBalance: credit.outstandingBalance } : null);
      }
      await refreshCreditModalLedger(creditModal.uid);
      await fetchData();
      showToast('Payment recorded in ledger.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleRecordCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditModal) return;
    const amount = parseInt(creditNoteAmount, 10);
    if (!amount || amount <= 0) {
      showToast('Enter a valid credit note amount.', 'info');
      return;
    }
    setRecordingCreditNote(true);
    try {
      await DBService.recordDealerCreditNote(creditModal.uid, amount, creditNoteNote);
      setCreditNoteAmount('');
      setCreditNoteNote('');
      const dealer = dealers.find((d) => d.uid === creditModal.uid);
      if (dealer) {
        const credit = getDealerCreditInfo({
          ...dealer,
          outstandingBalance: Math.max(0, (dealer.outstandingBalance ?? 0) - amount),
        });
        setCreditModal((prev) => prev ? { ...prev, outstandingBalance: credit.outstandingBalance } : null);
      }
      await refreshCreditModalLedger(creditModal.uid);
      await fetchData();
      showToast('Credit note recorded in ledger.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to record credit note.');
    } finally {
      setRecordingCreditNote(false);
    }
  };

  const handleSaveCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditModal) return;
    setSavingCredit(true);
    try {
      await DBService.updateDealerCredit(creditModal.uid, {
        creditLimit: creditModal.creditLimit,
        outstandingBalance: creditModal.outstandingBalance,
        creditDays: creditModal.creditDays,
      });
      await refreshCreditModalLedger(creditModal.uid);
      await fetchData();
      showToast('Dealer credit settings updated.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update credit.');
    } finally {
      setSavingCredit(false);
    }
  };

  const handleSaveDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealerModal) return;
    setDealerError(null);

    if (!dealerModal.companyName || !dealerModal.ownerName || !dealerModal.email || !dealerModal.mobile || !dealerModal.password) {
      setDealerError("Please fill in all mandatory fields (Company Name, Owner Name, Email, Mobile and Password).");
      return;
    }

    if (dealerModal.password.length < 6) {
      setDealerError("Password must be at least 6 characters.");
      return;
    }

    setAddingDealer(true);
    try {
      await DBService.addDealer({
        companyName: dealerModal.companyName,
        ownerName: dealerModal.ownerName,
        mobile: dealerModal.mobile,
        email: dealerModal.email,
        gstNumber: dealerModal.gstNumber || 'N/A',
        city: dealerModal.city || 'N/A',
        state: dealerModal.state,
        address: dealerModal.address || 'N/A',
        password: dealerModal.password,
        creditLimit: dealerModal.creditLimit,
        creditDays: dealerModal.creditDays,
      });
      setDealerModal(null);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      setDealerError(err?.message || "Failed to add dealer account.");
    } finally {
      setAddingDealer(false);
    }
  };

  const handleOpenReasonModal = (uid: string, company: string, action: 'Reject' | 'Suspend') => {
    setFeedbackReasonText('');
    setReasonModal({
      dealerId: uid,
      companyName: company,
      actionType: action
    });
  };

  const handleConfirmReasonModal = async () => {
    if (!reasonModal) return;
    const { dealerId, actionType } = reasonModal;
    
    if (actionType === 'Reject') {
      await handleStatusChange(dealerId, 'Rejected', { rejectReason: feedbackReasonText || "Does not meet registered wholesale criteria." });
    } else {
      await handleStatusChange(dealerId, 'Suspended', { suspendReason: feedbackReasonText || "Temporarily suspended due to billing or credit review." });
    }
    
    setReasonModal(null);
  };

  const handleAdvanceOrder = async (reqId: string) => {
    const reqBefore = requirements.find((r) => r.id === reqId);
    setFulfillingReqId(reqId);
    try {
      const nextStatus = await DBService.advanceOrderStatus(reqId);
      const [allProds] = await Promise.all([DBService.getProducts()]);
      const productAfter = reqBefore ? allProds.find((p) => p.id === reqBefore.productId) : undefined;
      await fetchData();
      const stockNote = nextStatus === 'Packed' && productAfter
        ? ` Stock updated to ${productAfter.availableStock} units.`
        : '';
      showToast(`Order moved to ${nextStatus}.${stockNote}`, 'info');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to advance order.';
      console.error(e);
      showToast(msg);
    } finally {
      setFulfillingReqId(null);
    }
  };

  const handleCancelOrder = async (reqId: string) => {
    setFulfillingReqId(reqId);
    try {
      await DBService.updateOrderStatus(reqId, 'Cancelled');
      await fetchData();
      showToast('Order cancelled.', 'info');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to cancel order.';
      console.error(e);
      showToast(msg);
    } finally {
      setFulfillingReqId(null);
    }
  };

  const handleDeleteRequirement = (reqId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Order",
      message: "Are you sure you want to permanently delete this completed or cancelled order record?",
      actionLabel: "Permanently Delete",
      onConfirm: async () => {
        try {
          await DBService.deleteStockRequirement(reqId);
          await fetchData();
        } catch (e) {
          console.error(e);
          showToast('Failed to delete stock requirement.');
        }
      }
    });
  };

  // --- Category Management Handlers ---
  const handleOpenAddCategory = () => {
    setCategoryModal({
      isOpen: true,
      mode: 'add',
      name: '',
      description: '',
      isActive: true
    });
  };

  const handleOpenEditCategory = (cat: CategoryItem) => {
    setCategoryModal({
      isOpen: true,
      mode: 'edit',
      categoryId: cat.id,
      name: cat.name,
      description: cat.description || '',
      isActive: cat.isActive
    });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryModal) return;

    try {
      if (categoryModal.mode === 'add') {
        await DBService.createCategory({
          name: categoryModal.name,
          description: categoryModal.description,
          isActive: categoryModal.isActive
        });
      } else if (categoryModal.categoryId) {
        await DBService.updateCategory(categoryModal.categoryId, {
          name: categoryModal.name,
          description: categoryModal.description,
          isActive: categoryModal.isActive
        });
      }
      setCategoryModal(null);
      await fetchData();
    } catch (err) {
      console.error("Save category failed", err);
    }
  };

  const handleToggleCategoryActive = async (cat: CategoryItem) => {
    try {
      await DBService.updateCategory(cat.id, { isActive: !cat.isActive });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategory = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Category",
      message: `Are you sure you want to delete category "${name}"? Existing products in this category will not be deleted, but they should be updated manually.`,
      actionLabel: "Yes, Delete Category",
      onConfirm: async () => {
        try {
          await DBService.deleteCategory(id);
          await fetchData();
        } catch (err) {
          console.error(err);
        }
      }
    });
  };


  // --- Product Management Handlers ---
  const handleOpenAddProduct = () => {
    setProductModal({
      isOpen: true,
      mode: 'add',
      name: '',
      sku: '',
      category: categories[0]?.name || 'TV Unit Furniture',
      images: [],
      description: '',
      material: '',
      color: '',
      size: '',
      dimensions: '',
      weight: '',
      wholesalePrice: 5000,
      minimumOrderQuantity: 5,
      availableStock: 10,
      status: 'Available',
      isActive: true
    });
  };

  const handleOpenEditProduct = (p: ProductItem) => {
    setProductModal({
      isOpen: true,
      mode: 'edit',
      productId: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      images: p.images || [p.image] || [],
      description: p.description,
      material: p.material,
      color: p.color || '',
      size: p.size || '',
      dimensions: p.dimensions,
      weight: p.weight || '',
      wholesalePrice: p.wholesalePrice || p.price,
      minimumOrderQuantity: p.minimumOrderQuantity || 5,
      availableStock: p.availableStock || 0,
      status: p.status || (p.stockStatus === 'Out of Stock' ? 'Out Of Stock' : 'Available'),
      isActive: p.isActive !== false
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productModal) return;

    if (productModal.images.length === 0) {
      showToast('Please provide or upload at least one product image.', 'info');
      return;
    }

    const mainImage = productModal.images[0];
    const computedStockStatus = productModal.status === 'Out Of Stock' || productModal.availableStock === 0
      ? 'Out of Stock'
      : productModal.availableStock <= 5
      ? 'Low Stock'
      : 'In Stock';

    const fields: Omit<ProductItem, 'id' | 'createdDate'> = {
      name: productModal.name,
      sku: productModal.sku,
      category: productModal.category,
      price: productModal.wholesalePrice,
      wholesalePrice: productModal.wholesalePrice,
      image: mainImage,
      images: productModal.images,
      stockStatus: computedStockStatus,
      status: productModal.status,
      description: productModal.description,
      material: productModal.material,
      color: productModal.color,
      size: productModal.size,
      dimensions: productModal.dimensions,
      weight: productModal.weight,
      minimumOrderQuantity: productModal.minimumOrderQuantity,
      availableStock: productModal.availableStock,
      isActive: productModal.isActive
    };

    try {
      if (productModal.mode === 'add') {
        await DBService.createProduct(fields);
      } else if (productModal.productId) {
        await DBService.updateProduct(productModal.productId, fields);
      }
      setProductModal(null);
      await fetchData();
    } catch (err) {
      console.error("Save product failed", err);
    }
  };

  const handleToggleProductActive = async (p: ProductItem) => {
    try {
      await DBService.updateProduct(p.id, { isActive: p.isActive === false ? true : false });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProduct = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Furniture Product",
      message: `Are you absolutely sure you want to permanently delete product "${name}"? This action cannot be undone and will delete it from the live B2B list.`,
      actionLabel: "Yes, Delete Product",
      onConfirm: async () => {
        try {
          await DBService.deleteProduct(id);
          await fetchData();
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !productModal) return;
    const files = Array.from(e.target.files) as File[];
    setUploadingImages(true);
    const uploadedUrls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const sku = productModal.sku || 'PROD';
        const url = await DBService.uploadProductImage(files[i], sku, i);
        uploadedUrls.push(url);
      }
      setProductModal(prev => prev ? {
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      } : null);
    } catch (err) {
      console.error("Image upload failed", err);
      showToast('Failed to upload image. Please try again.');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleDesignSheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !productModal) return;
    const file = e.target.files[0];
    setUploadingSheet(true);
    try {
      const sku = productModal.sku || 'PROD';
      const url = await DBService.uploadProductFile(file, sku, 'sheets');
      setProductModal(prev => prev ? { ...prev, designSheetUrl: url } : null);
    } catch (err) {
      console.error(err);
      showToast('Failed to upload design sheet.');
    } finally {
      setUploadingSheet(false);
    }
  };

  const handleBrochureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !productModal) return;
    const file = e.target.files[0];
    setUploadingBrochure(true);
    try {
      const sku = productModal.sku || 'PROD';
      const url = await DBService.uploadProductFile(file, sku, 'brochures');
      setProductModal(prev => prev ? { ...prev, brochureUrl: url } : null);
    } catch (err) {
      console.error(err);
      showToast('Failed to upload brochure.');
    } finally {
      setUploadingBrochure(false);
    }
  };

  // Filter lists based on search
  const searchQ = (searchTerm || '').toLowerCase();
  const matchesSearch = (...values: (string | undefined)[]) =>
    values.some((v) => (v || '').toLowerCase().includes(searchQ));

  const filteredDealers = dealers.filter((d) =>
    matchesSearch(d.companyName, d.ownerName, d.email, d.gstNumber, d.city, d.state)
  );

  const filteredRequirements = requirements.filter((r) =>
    matchesSearch(r.dealerCompanyName, r.productName, r.status)
  );

  const filteredCategories = categories.filter((c) =>
    matchesSearch(c.name, c.description)
  );

  const filteredProducts = products.filter((p) =>
    matchesSearch(p.name, p.sku, p.category, p.description, p.material)
  );

  const navItems = [
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3, count: null as number | null },
    { id: 'dealers' as const, label: 'Dealers', icon: Users, count: dealers.length },
    { id: 'requirements' as const, label: 'Orders', icon: ClipboardList, count: requirements.filter((r) => isActiveOrder(r.status)).length },
    { id: 'categories' as const, label: 'Categories', icon: Layers, count: categories.length },
    { id: 'products' as const, label: 'Products', icon: Package, count: products.length },
  ];

  const tabLabels: Record<typeof activeTab, string> = {
    analytics: 'Analytics',
    dealers: 'Dealers',
    requirements: 'Order Management',
    categories: 'Categories',
    products: 'Products',
  };

  return (
    <div className="cf-admin min-h-screen flex">
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <aside className="cf-admin-sidebar hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen border-r border-white/10">
        <div className="p-5 border-b border-white/10 flex flex-col items-center gap-1.5">
          <BrandLogo size="md" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-cf-muted">Admin Console</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              id={`sidebar-tab-${id}`}
              type="button"
              onClick={() => { setActiveTab(id); setSearchTerm(''); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                activeTab === id
                  ? 'cf-admin-nav-active'
                  : 'text-white/70 cf-admin-nav-item'
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </span>
              {count != null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${activeTab === id ? 'bg-[#222222]/20' : 'bg-[#222222]/10'}`}>
                {count}
              </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-3">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Logged in</p>
            <p id="admin-name" className="text-sm font-semibold text-white truncate">{adminUser.ownerName}</p>
          </div>
          <button
            id="admin-logout-btn"
            type="button"
            onClick={onLogout}
            className="w-full py-2 px-3 rounded-lg border border-white/20 text-white text-xs font-semibold hover:bg-white/10 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile / tablet top bar */}
        <header className="lg:hidden cf-admin-sidebar px-4 py-3 flex items-center justify-between sticky top-0 z-20 border-b border-white/10 pr-14">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-cf-muted">Admin</span>
          </div>
          <button type="button" onClick={onLogout} className="p-2 rounded-lg border border-white/20">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Desktop page header */}
        <div className="hidden lg:flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <h1 id="admin-h1" className="text-2xl font-semibold text-white">{tabLabels[activeTab]}</h1>
            <p id="admin-sub" className="text-sm text-cf-secondary">Crystal Furnitech · Luxury backoffice</p>
          </div>
          <BrandLogo size="sm" />
        </div>

        {/* Mobile tab nav */}
        <div className="lg:hidden cf-admin-card p-4 space-y-3">
          <div className="flex flex-wrap gap-2 bg-[#171717] p-1 border border-white/10 rounded-lg">
            {navItems.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                id={`tab-${id}`}
                type="button"
                onClick={() => { setActiveTab(id); setSearchTerm(''); }}
                className={`py-2 px-3 sm:px-4 rounded-md font-semibold text-[11px] sm:text-xs tracking-wide transition flex items-center gap-2 cursor-pointer ${
                  activeTab === id
                    ? 'bg-gradient-to-r from-[#b65200] to-[#d66b0f] text-white shadow-md'
                    : 'text-cf-muted hover:text-[#d4af37]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}{count != null ? ` (${count})` : ''}
              </button>
            ))}
          </div>

          {activeTab !== 'analytics' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative grow sm:w-60">
              <Search className="w-4 h-4 text-cf-muted absolute left-3 top-3.5" />
              <input 
                id="admin-search"
                type="text"
                placeholder={
                  activeTab === 'dealers' ? "Search dealers..." : 
                  activeTab === 'requirements' ? "Search orders..." :
                  activeTab === 'categories' ? "Search categories..." : 
                  "Search SKU, product material, color..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="cf-input w-full pl-9 pr-4 py-3 text-xs"
              />
            </div>

            {activeTab === 'dealers' && (
              <button id="btn-add-dealer-cta" type="button" onClick={handleOpenAddDealer} className="py-3 px-4 cf-btn-brand text-xs rounded-lg flex items-center gap-1.5 whitespace-nowrap">
                <Plus className="w-4 h-4" /> Add Dealer
              </button>
            )}
            {activeTab === 'categories' && (
              <button id="btn-add-category-cta" type="button" onClick={handleOpenAddCategory} className="py-3 px-4 cf-btn-brand text-xs rounded-lg flex items-center gap-1.5 whitespace-nowrap">
                <Plus className="w-4 h-4" /> Add Category
              </button>
            )}
            {activeTab === 'products' && (
              <button id="btn-add-product-cta" type="button" onClick={handleOpenAddProduct} className="py-3 px-4 cf-btn-brand text-xs rounded-lg flex items-center gap-1.5 whitespace-nowrap">
                <Plus className="w-4 h-4" /> Add Product
              </button>
            )}

            <button id="btn-admin-refresh" type="button" onClick={fetchData} disabled={loading} title="Refresh Data List" className="p-3 cf-input hover:border-[#d4af37] rounded-lg cursor-pointer transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 text-[#d4af37] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          )}
        </div>

        {activeTab === 'analytics' && (
          <AdminAnalytics dealers={dealers} products={products} requirements={requirements} />
        )}

        {activeTab !== 'analytics' && (
        <>
        {/* Statistics Panels */}
        <div className="hidden lg:grid grid-cols-2 md:grid-cols-5 gap-4">
          
          <div className="cf-admin-card p-5 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-[#171717] text-[#d4af37] rounded-lg border border-white/10">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-cf-muted font-semibold block uppercase">All Dealers</span>
              <span className="text-2xl font-semibold text-white">{statusCounts.total}</span>
            </div>
          </div>

          <div className="cf-admin-card p-5 rounded-xl flex items-center gap-4 border-l-2 border-l-[#d4af37]">
            <div className="p-3 bg-[#f59e0b]/10 text-[#f59e0b] rounded-lg border border-[#f59e0b]/20">
              <Hourglass className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#f59e0b] font-semibold block uppercase">Pending</span>
              <span className="text-2xl font-semibold text-white">{statusCounts.pending}</span>
            </div>
          </div>

          <div className="cf-admin-card p-5 rounded-xl flex items-center gap-4 border-l-2 border-l-[#10b981]">
            <div className="p-3 bg-[#10b981]/10 text-[#10b981] rounded-lg border border-[#10b981]/20">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#10b981] font-semibold block uppercase">Approved</span>
              <span className="text-2xl font-semibold text-white">{statusCounts.approved}</span>
            </div>
          </div>

          <div className="cf-admin-card p-5 rounded-xl flex items-center gap-4 border-l-2 border-l-[#ef4444]">
            <div className="p-3 bg-[#ef4444]/10 text-[#ef4444] rounded-lg border border-[#ef4444]/20">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#ef4444] font-semibold block uppercase">Rejected</span>
              <span className="text-2xl font-semibold text-white">{statusCounts.rejected}</span>
            </div>
          </div>

          <div className="cf-admin-card p-5 rounded-xl flex items-center gap-4 border-l-2 border-l-yellow-500 col-span-2 md:col-span-1">
            <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-lg border border-yellow-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-yellow-500 font-semibold block uppercase">Suspended</span>
              <span className="text-2xl font-semibold text-white">{statusCounts.suspended}</span>
            </div>
          </div>

        </div>

        {/* Desktop toolbar — search & actions */}
        <div className="hidden lg:flex flex-col gap-4 cf-admin-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative grow sm:w-60">
              <Search className="w-4 h-4 text-cf-muted absolute left-3 top-3.5" />
              <input
                id="admin-search-desktop"
                type="text"
                placeholder={
                  activeTab === 'dealers' ? "Search dealers..." :
                  activeTab === 'requirements' ? "Search orders..." :
                  activeTab === 'categories' ? "Search categories..." :
                  "Search SKU, product material, color..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="cf-input w-full pl-9 pr-4 py-3 text-xs"
              />
            </div>
            {activeTab === 'dealers' && (
              <button type="button" onClick={handleOpenAddDealer} className="py-3 px-4 cf-btn-brand text-xs rounded-lg flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add Dealer
              </button>
            )}
            {activeTab === 'categories' && (
              <button type="button" onClick={handleOpenAddCategory} className="py-3 px-4 cf-btn-brand text-xs rounded-lg flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add Category
              </button>
            )}
            {activeTab === 'products' && (
              <button type="button" onClick={handleOpenAddProduct} className="py-3 px-4 cf-btn-brand text-xs rounded-lg flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add Product
              </button>
            )}
            <button type="button" onClick={fetchData} disabled={loading} className="p-3 cf-input hover:border-[#d4af37] rounded-lg transition disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 text-[#d4af37] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Details and Lists Grid */}
        <div className="bg-[#222222] rounded-xl border border-white/10 overflow-hidden">
          
          {activeTab === 'dealers' && (
            
            /* --- Dealers Management Tab Panel --- */
            <div className="overflow-x-auto min-w-full">
              <table className="cf-admin-table min-w-full">
                <thead>
                  <tr>
                    <th>Company Details</th>
                    <th>Contact Details</th>
                    <th>GST Identification</th>
                    <th>City & State</th>
                    <th>Registered On</th>
                    <th>Credit</th>
                    <th>Status</th>
                    <th className="text-right">Backoffice Actions</th>
                  </tr>
                </thead>
                <tbody>
                   {filteredDealers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="cf-td-empty">
                        <Users className="w-10 h-10 mx-auto text-cf-muted mb-2 opacity-40" />
                        No dealer accounts match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDealers.map((dl) => (
                      <tr key={dl.uid}>
                        
                        {/* Company Detail Column */}
                        <td className="py-4 px-5">
                          <div>
                            <span className="cf-td-title">{dl.companyName}</span>
                            <span className="cf-td-meta block mt-0.5">Owner: {dl.ownerName}</span>
                          </div>
                        </td>

                        {/* Contact Details */}
                        <td className="py-4 px-5">
                          <div className="space-y-0.5">
                            <span className="cf-td-value block">{dl.email}</span>
                            <span className="cf-td-meta block">Mobile: +91 {dl.mobile}</span>
                          </div>
                        </td>

                        {/* GST Number */}
                        <td className="py-4 px-5 cf-td-mono cf-td-mono-upper">
                          {dl.gstNumber}
                        </td>

                        {/* City/State */}
                        <td className="py-4 px-5">
                          <div>
                            <span className="cf-td-value font-semibold block">{dl.city}</span>
                            <span className="cf-td-meta block">{dl.state}</span>
                          </div>
                        </td>

                        {/* Registration Date */}
                        <td className="py-4 px-5 cf-td-date">
                          {new Date(dl.registrationDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>

                        {/* Credit summary */}
                        <td className="py-4 px-5">
                          {(() => {
                            const credit = getDealerCreditInfo(dl);
                            return (
                              <div className="text-[10px] space-y-0.5">
                                <span className="cf-td-value block">Avail: <strong className="text-[#d4af37]">{formatINR(credit.availableCredit)}</strong></span>
                                <span className="cf-td-meta block">Out: {formatINR(credit.outstandingBalance)} / {formatINR(credit.creditLimit)}</span>
                                <span className="cf-td-meta block">{credit.creditDays} days</span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Status badge, showing warnings if has custom reason values */}
                        <td className="py-4 px-5">
                          <div>
                            <span className={`inline-flex px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                              dl.status === 'Approved' 
                                ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20' 
                                : dl.status === 'Pending Approval' 
                                ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20'
                                : dl.status === 'Rejected'
                                ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20'
                                : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                            }`}>
                              {dl.status}
                            </span>
                            
                            {(dl.status === 'Rejected' && dl.rejectionReason) && (
                              <span className="block text-[9px] text-[#ef4444] mt-1 max-w-[150px] truncate" title={dl.rejectionReason}>
                                Reason: {dl.rejectionReason}
                              </span>
                            )}
                            {(dl.status === 'Suspended' && dl.suspensionReason) && (
                              <span className="block text-[9px] text-yellow-500 mt-1 max-w-[150px] truncate" title={dl.suspensionReason}>
                                Reason: {dl.suspensionReason}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Backoffice Operations Controls */}
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1.5">
                            
                            {/* Approve trigger button */}
                            {dl.status !== 'Approved' && (
                              <button
                                id={`btn-approve-${dl.uid}`}
                                type="button"
                                title="Approve Dealer Partnership"
                                onClick={() => handleStatusChange(dl.uid, 'Approved')}
                                className="p-1.5 bg-transparent hover:bg-[#10b981] hover:text-white hover:border-transparent text-[#10b981] border border-white/10 rounded-lg cursor-pointer transition duration-200"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}

                            {/* Reject trigger button, prompts custom reason modal */}
                            {dl.status !== 'Rejected' && (
                              <button
                                id={`btn-reject-${dl.uid}`}
                                type="button"
                                title="Reject Dealer Application"
                                onClick={() => handleOpenReasonModal(dl.uid, dl.companyName, 'Reject')}
                                className="p-1.5 bg-transparent hover:bg-[#ef4444] hover:text-white hover:border-transparent text-[#ef4444] border border-white/10 rounded-lg cursor-pointer transition duration-200"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}

                            {/* Suspend action */}
                            {dl.status === 'Approved' && (
                              <button
                                id={`btn-credit-${dl.uid}`}
                                type="button"
                                title="Edit Credit Limit"
                                onClick={() => handleOpenCreditModal(dl)}
                                className="p-1.5 bg-transparent hover:bg-[#d4af37]/20 hover:text-[#d4af37] text-[#d4af37] border border-white/10 rounded-lg cursor-pointer transition duration-200"
                              >
                                <Landmark className="w-4 h-4" />
                              </button>
                            )}

                            {dl.status === 'Approved' && (
                              <button
                                id={`btn-suspend-${dl.uid}`}
                                type="button"
                                title="Suspend Account Privileges"
                                onClick={() => handleOpenReasonModal(dl.uid, dl.companyName, 'Suspend')}
                                className="p-1.5 bg-transparent hover:bg-yellow-500 hover:text-white hover:border-transparent text-yellow-500 border border-white/10 rounded-lg cursor-pointer transition duration-200"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete button (Permanent) */}
                            <button
                              id={`btn-delete-${dl.uid}`}
                              type="button"
                              title="Delete Dealer Record"
                              onClick={() => handleDeleteDealer(dl.uid, dl.companyName)}
                              className="p-1.5 bg-transparent hover:bg-[#ef4444] hover:text-white hover:border-transparent text-cf-muted border border-white/10 rounded-lg cursor-pointer transition duration-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                          </div>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          )}

          {activeTab === 'requirements' && (
            
            /* --- Order Management Tab Panel --- */
            <div className="overflow-x-auto min-w-full">
              <div className="mb-4 hidden lg:block">
                <p className="text-xs text-cf-secondary">
                  Indent → Order workflow: Pending → Approved → Production → Packed → Dispatched → Delivered
                </p>
              </div>
              <table className="cf-admin-table min-w-full">
                <thead>
                  <tr>
                    <th>Partner Dealer</th>
                    <th>Product Details</th>
                    <th className="text-center">Qty</th>
                    <th>Order Value</th>
                    <th>Date Posted</th>
                    <th>Order Pipeline</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequirements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="cf-td-empty">
                        <ClipboardList className="w-10 h-10 mx-auto text-cf-muted mb-2 opacity-40" />
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    filteredRequirements.map((rq) => {
                      const normalizedStatus = normalizeOrderStatus(rq.status);
                      const advanceLabel = orderAdvanceLabel(rq.status);
                      const orderVal = rq.orderValue || 0;

                      return (
                        <tr key={rq.id}>
                          
                          {/* Dealer Company */}
                          <td className="py-4 px-5">
                            <div>
                              <span className="cf-td-title">{rq.dealerCompanyName}</span>
                              <span className="cf-td-meta block mt-0.5">Dealer Ref: {rq.dealerId.substring(0, 8)}...</span>
                            </div>
                          </td>

                          {/* Product requested info */}
                          <td className="py-4 px-5">
                            <div>
                              <span className="cf-td-value font-semibold block text-xs">{rq.productName}</span>
                              <span className="cf-td-meta block font-mono mt-0.5">ID: {rq.productId}</span>
                              {rq.notes && (
                                <p className="cf-td-meta italic mt-1 bg-[#171717] border border-white/10 p-1 rounded font-sans max-w-xs whitespace-normal">
                                  "{rq.notes}"
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="py-4 px-5 text-center cf-td-title text-sm">
                            {rq.quantityRequested} units
                          </td>

                          {/* Order Value */}
                          <td className="py-4 px-5 cf-td-mono">
                            {formatINR(orderVal)}
                          </td>

                          {/* Date request */}
                          <td className="py-4 px-5 cf-td-date">
                            {new Date(rq.requestedDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>

                          {/* Order pipeline */}
                          <td className="py-4 px-5 min-w-[200px]">
                            <div className="space-y-2">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${orderStatusBadgeClass(rq.status)}`}>
                                {orderStatusLabel(rq.status)}
                              </span>
                              <OrderProgress status={rq.status} compact className="max-w-[180px]" />
                            </div>
                          </td>

                          {/* Order actions */}
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            {isActiveOrder(rq.status) ? (
                              <div className="flex justify-end gap-1.5 flex-wrap">
                                {advanceLabel && (
                                  <button
                                    id={`btn-advance-${rq.id}`}
                                    type="button"
                                    disabled={fulfillingReqId === rq.id}
                                    onClick={() => handleAdvanceOrder(rq.id)}
                                    className="py-1 px-2.5 bg-transparent hover:bg-[#10b981]/20 hover:text-[#10b981] border border-white/10 text-white font-semibold text-[10px] rounded-lg transition disabled:opacity-50"
                                  >
                                    {fulfillingReqId === rq.id ? 'Processing...' : advanceLabel}
                                  </button>
                                )}
                                {canAdminCancel(rq.status) && (
                                  <button
                                    id={`btn-cancel-${rq.id}`}
                                    type="button"
                                    disabled={fulfillingReqId === rq.id}
                                    onClick={() => handleCancelOrder(rq.id)}
                                    className="py-1 px-2.5 bg-transparent hover:bg-[#ef4444]/20 hover:text-[#ef4444] border border-white/10 text-[#ef4444] font-semibold text-[10px] rounded-lg transition disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex justify-end items-center gap-2">
                                <span className="text-[10px] text-cf-muted font-medium">
                                  {normalizedStatus === 'Delivered' ? 'Completed' : 'Cancelled'}
                                </span>
                                <button
                                  id={`btn-delete-req-${rq.id}`}
                                  type="button"
                                  onClick={() => handleDeleteRequirement(rq.id)}
                                  className="p-1 px-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 rounded-lg transition flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                                  title="Delete Order Record"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          )}

          {activeTab === 'categories' && (
            
            /* --- Category Management Panel (Step 3) --- */
            <div className="overflow-x-auto min-w-full animate-fade-in">
              <table className="cf-admin-table min-w-full">
                <thead>
                  <tr>
                    <th>Category Name</th>
                    <th>Description</th>
                    <th>Date Created</th>
                    <th>Status</th>
                    <th className="text-right">Backoffice CRM Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="cf-td-empty">
                        <Layers className="w-10 h-10 mx-auto text-cf-muted mb-2 opacity-40" />
                        No categories found. Click 'Add Category' to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((cat) => (
                      <tr key={cat.id}>
                        
                        {/* Category Name */}
                        <td className="py-4 px-5">
                          <span className="cf-td-title">{cat.name}</span>
                          <span className="cf-td-meta font-mono block mt-0.5">ID: {cat.id}</span>
                        </td>

                        {/* Description */}
                        <td className="py-4 px-5 max-w-xs whitespace-normal font-sans">
                          {cat.description
                            ? <span className="cf-td-value">{cat.description}</span>
                            : <span className="cf-td-meta italic">No description provided</span>}
                        </td>

                        {/* Date Created */}
                        <td className="py-4 px-5 cf-td-date font-mono font-medium">
                          {cat.createdDate ? new Date(cat.createdDate).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          }) : '-'}
                        </td>

                        {/* Status (Active/Inactive) */}
                        <td className="py-4 px-5">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            cat.isActive 
                              ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25' 
                              : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                          }`}>
                            {cat.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* CRM Actions */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1.5">
                            
                            {/* Activate / Deactivate Toggle */}
                            <button
                              id={`btn-toggle-cat-${cat.id}`}
                              type="button"
                              title={cat.isActive ? "Deactivate Category" : "Activate Category"}
                              onClick={() => handleToggleCategoryActive(cat)}
                              className={`p-1.5 border border-white/10 rounded-lg cursor-pointer transition ${
                                cat.isActive 
                                  ? 'hover:bg-yellow-500/20 text-yellow-500 hover:text-yellow-400' 
                                  : 'hover:bg-[#10b981]/20 text-zinc-400 hover:text-[#10b981]'
                              }`}
                            >
                              {cat.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>

                            {/* Edit Button */}
                            <button
                              id={`btn-edit-cat-${cat.id}`}
                              type="button"
                              title="Edit Category Details"
                              onClick={() => handleOpenEditCategory(cat)}
                              className="p-1.5 bg-transparent hover:bg-zinc-800 hover:text-white text-white border border-white/10 rounded-lg cursor-pointer transition duration-200"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button
                              id={`btn-delete-cat-${cat.id}`}
                              type="button"
                              title="Delete Category"
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              className="p-1.5 bg-transparent hover:bg-[#ef4444] hover:text-white text-[#ef4444] border border-white/10 rounded-lg cursor-pointer transition duration-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                          </div>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          )}

          {activeTab === 'products' && (
            
            /* --- Product Management Panel (Step 4) --- */
            <div className="overflow-x-auto min-w-full animate-fade-in">
              <table className="cf-admin-table min-w-full">
                <thead>
                  <tr>
                    <th>Product Details</th>
                    <th>Category & SKU</th>
                    <th>Wholesale Price</th>
                    <th>Inventory Stock & Status</th>
                    <th>Created Date</th>
                    <th className="text-right">Backoffice CRM Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="cf-td-empty">
                        <Package className="w-10 h-10 mx-auto text-cf-muted mb-2 opacity-40" />
                        No product items found. Click 'Add Product' to establish a B2B catalog item.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const allPics = p.images || (p.image ? [p.image] : []);
                      return (
                        <tr key={p.id}>
                          
                          {/* Rich Product Detail layout */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className="relative w-12 h-12 rounded-lg border border-white/10 overflow-hidden bg-zinc-900 flex-shrink-0">
                                <img 
                                  src={p.image || "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&q=80&w=300"} 
                                  alt={p.name} 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                                {allPics.length > 1 && (
                                  <span className="absolute bottom-0.5 right-0.5 bg-black/85 text-[8px] text-white px-1 font-bold rounded">
                                    +{allPics.length - 1}
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="cf-td-title leading-tight">{p.name}</span>
                                <span className="cf-td-meta block mt-1">{p.material} &bull; {p.color || 'No color spec'}</span>
                              </div>
                            </div>
                          </td>

                          {/* Category & SKU */}
                          <td className="py-4 px-5">
                            <div>
                              <span className="cf-td-value font-semibold block">{p.category}</span>
                              <span className="cf-td-meta font-mono mt-0.5 block">SKU: {p.sku}</span>
                            </div>
                          </td>

                          {/* Price details */}
                          <td className="py-4 px-5 cf-td-mono text-xs">
                            <div>
                              <span className="text-sm">₹{(p.wholesalePrice || p.price).toLocaleString('en-IN')}</span>
                              <span className="cf-td-meta block font-semibold mt-0.5">MOQ: {p.minimumOrderQuantity || 1} units</span>
                            </div>
                          </td>

                          {/* Stock status indicator */}
                          <td className="py-4 px-5">
                            <div>
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                p.status === 'Out Of Stock' || (p.availableStock === 0)
                                  ? 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/25'
                                  : (p.availableStock <= 5)
                                  ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 animate-pulse'
                                  : 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25'
                              }`}>
                                {p.status === 'Out Of Stock' || p.availableStock === 0 ? 'Out of Stock' : 'In Stock'}
                              </span>
                              <span className="cf-td-meta block mt-1 font-semibold">{p.availableStock} items in shop</span>
                            </div>
                          </td>

                          {/* Created Date */}
                          <td className="py-4 px-5 cf-td-date font-mono font-medium">
                            {p.createdDate ? new Date(p.createdDate).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            }) : '-'}
                          </td>

                          {/* Product CRM backoffice controls */}
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1.5">
                              
                              {/* Toggle active display on B2B portal */}
                              <button
                                id={`btn-toggle-prod-${p.id}`}
                                type="button"
                                title={p.isActive !== false ? "Hide from B2B Portal" : "Show on B2B Portal"}
                                onClick={() => handleToggleProductActive(p)}
                                className={`p-1.5 border border-white/10 rounded-lg cursor-pointer transition ${
                                  p.isActive !== false 
                                    ? 'hover:bg-yellow-500/20 text-yellow-500 hover:text-yellow-400' 
                                    : 'hover:bg-[#10b981]/20 text-zinc-400 hover:text-[#10b981]'
                                }`}
                              >
                                {p.isActive !== false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>

                              {/* Edit details */}
                              <button
                                id={`btn-edit-prod-${p.id}`}
                                type="button"
                                title="Edit Catalog Attributes"
                                onClick={() => handleOpenEditProduct(p)}
                                className="p-1.5 bg-transparent hover:bg-zinc-800 hover:text-white text-white border border-white/10 rounded-lg cursor-pointer transition duration-200"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* Delete catalog item */}
                              <button
                                id={`btn-delete-prod-${p.id}`}
                                type="button"
                                title="Delete Product permanently"
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                className="p-1.5 bg-transparent hover:bg-[#ef4444] hover:text-white text-[#ef4444] border border-white/10 rounded-lg cursor-pointer transition duration-200"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>

                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          )}

        </div>

        </>
        )}

      </main>

      {/* Modals live inside content column */}
      {/* Reject / Suspend Feedback reason modal (Zero-dependency custom implementation) */}
      {reasonModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#222222] rounded-xl border border-white/10 max-w-sm w-full p-6 space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
                Reason for Status Change
              </h4>
              <button 
                type="button"
                onClick={() => setReasonModal(null)}
                className="text-cf-muted hover:text-cf-primary transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-cf-secondary leading-relaxed">
              Define the feedback reasons for <strong className="text-white">{reasonModal.companyName}</strong>. This custom message is displayed instantly on their login block.
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-cf-muted">Detailed Feedback Reason</label>
              <textarea
                value={feedbackReasonText}
                onChange={(e) => setFeedbackReasonText(e.target.value)}
                placeholder={reasonModal.actionType === 'Reject' 
                  ? "e.g. Invalid GST registration parameters submitted for the Maharashtra region."
                  : "e.g. Accounts frozen pending statutory wholesale registration updates."
                }
                rows={3}
                className="w-full text-xs p-2.5 bg-[#171717] border border-white/10 text-white placeholder-zinc-500 rounded-lg focus:border-[#b65200] outline-none resize-none transition"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="flex-1 py-2 bg-transparent hover:bg-[#171717] text-xs text-white rounded-lg border border-white/10 font-semibold transition"
              >
                Go Back
              </button>
              <button
                id="btn-confirm-reason-change"
                type="button"
                onClick={handleConfirmReasonModal}
                className="flex-1 py-2 bg-[#b65200] hover:bg-[#d66b0f] text-white rounded-lg text-xs font-semibold transition shadow-md"
              >
                Apply status
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Category Add/Edit Modal (Step 3) */}
      {categoryModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#222222] rounded-xl border border-white/10 max-w-sm w-full p-6 space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="w-5 h-5 text-zinc-400" />
                {categoryModal.mode === 'add' ? 'Create New Category' : 'Edit Category'}
              </h4>
              <button 
                type="button"
                onClick={() => setCategoryModal(null)}
                className="text-cf-muted hover:text-cf-primary transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Category Name *</label>
                <input
                  required
                  type="text"
                  value={categoryModal.name}
                  onChange={(e) => setCategoryModal(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="e.g. TV Unit Furniture"
                  className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Description (Optional)</label>
                <textarea
                  value={categoryModal.description}
                  onChange={(e) => setCategoryModal(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Describe items under this collection..."
                  rows={3}
                  className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white placeholder-zinc-500 rounded-lg focus:border-[#b65200] outline-none resize-none transition"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="cat-active-checkbox"
                  checked={categoryModal.isActive}
                  onChange={(e) => setCategoryModal(prev => prev ? { ...prev, isActive: e.target.checked } : null)}
                  className="w-4 h-4 accent-[#fafafa] rounded text-zinc-950 border-white/10 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="cat-active-checkbox" className="text-xs font-semibold text-white cursor-pointer">
                  Activate instantly for B2B cataloging
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryModal(null)}
                  className="flex-1 py-3 bg-transparent hover:bg-[#171717] text-xs text-white rounded-lg border border-white/10 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-cat"
                  type="submit"
                  className="flex-1 py-3 bg-[#b65200] hover:bg-[#d66b0f] text-white rounded-lg text-xs font-bold transition shadow-md"
                >
                  Save Category
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Dealer Addition Modal */}
      {dealerModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#222222] rounded-xl border border-white/10 max-w-xl w-full p-6 space-y-4 shadow-2xl my-auto animate-fade-in max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Users className="w-5 h-5 text-zinc-400" />
                Add New Dealer Partner
              </h4>
              <button 
                type="button"
                onClick={() => setDealerModal(null)}
                className="text-cf-muted hover:text-cf-primary transition cursor-pointer"
              >
                <X className="w-4 h-4 animate-duration-150" />
              </button>
            </div>

            {dealerError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                {dealerError}
              </div>
            )}

            <form onSubmit={handleSaveDealer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Company Name *</label>
                  <input
                    required
                    type="text"
                    value={dealerModal.companyName}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, companyName: e.target.value } : null)}
                    placeholder="e.g. Furnitech Enterprises"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Owner Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Owner Name *</label>
                  <input
                    required
                    type="text"
                    value={dealerModal.ownerName}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, ownerName: e.target.value } : null)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Email Address *</label>
                  <input
                    required
                    type="email"
                    value={dealerModal.email}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, email: e.target.value } : null)}
                    placeholder="rajesh@furnitech.com"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Mobile Number */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Mobile Number (+91) *</label>
                  <input
                    required
                    type="tel"
                    pattern="[0-9]{10}"
                    value={dealerModal.mobile}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, mobile: e.target.value.replace(/\D/g, '').substring(0, 10) } : null)}
                    placeholder="10-digit mobile number"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* GST Number */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">GST Number (Optional)</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={dealerModal.gstNumber}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, gstNumber: e.target.value.toUpperCase() } : null)}
                    placeholder="e.g. 27AAAAA1111A1Z1"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* City */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">City</label>
                  <input
                    type="text"
                    value={dealerModal.city}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, city: e.target.value } : null)}
                    placeholder="e.g. Mumbai"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* State */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">State</label>
                  <input
                    type="text"
                    value={dealerModal.state}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, state: e.target.value } : null)}
                    placeholder="e.g. Maharashtra"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Credit Limit */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Credit Limit (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={dealerModal.creditLimit}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, creditLimit: Math.max(0, parseInt(e.target.value) || 0) } : null)}
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Credit Days */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Credit Days</label>
                  <input
                    type="number"
                    min={0}
                    value={dealerModal.creditDays}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, creditDays: Math.max(0, parseInt(e.target.value) || 0) } : null)}
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Log-in Password *</label>
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={dealerModal.password}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, password: e.target.value } : null)}
                    placeholder="Minimum 6 characters"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Complete Address */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Registered Address</label>
                  <textarea
                    value={dealerModal.address}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, address: e.target.value } : null)}
                    placeholder="Detailed warehouse or office coordinates..."
                    rows={2}
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white placeholder-zinc-500 rounded-lg focus:border-[#b65200] outline-none resize-none transition"
                  />
                </div>

              </div>

              <div className="flex gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setDealerModal(null)}
                  className="flex-1 py-3 bg-transparent hover:bg-[#171717] text-xs text-white rounded-lg border border-white/10 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-new-dealer"
                  type="submit"
                  disabled={addingDealer}
                  className="flex-1 py-3 bg-[#b65200] hover:bg-[#d66b0f] disabled:bg-neutral-300 disabled:text-neutral-500 text-white rounded-lg text-xs font-bold transition shadow-md flex items-center justify-center gap-1 cursor-pointer"
                >
                  {addingDealer && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {addingDealer ? 'Creating Account...' : 'Register Dealer'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#222222] border border-white/10 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl my-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#d4af37]" />
                Dealer Credit & Ledger
              </h3>
              <button type="button" onClick={() => setCreditModal(null)} className="text-cf-muted hover:text-cf-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-cf-secondary">{creditModal.companyName}</p>

            <div className="grid sm:grid-cols-2 gap-4">
              <form onSubmit={handleSaveCredit} className="space-y-3">
                <p className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Credit Settings</p>
                <div>
                  <label className="text-[10px] font-bold text-cf-muted uppercase">Credit Limit (₹)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={creditModal.creditLimit}
                    onChange={(e) => setCreditModal(prev => prev ? { ...prev, creditLimit: Math.max(0, parseInt(e.target.value) || 0) } : null)}
                    className="cf-input w-full mt-1 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-cf-muted uppercase">Outstanding Balance (₹)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={creditModal.outstandingBalance}
                    onChange={(e) => setCreditModal(prev => prev ? { ...prev, outstandingBalance: Math.max(0, parseInt(e.target.value) || 0) } : null)}
                    className="cf-input w-full mt-1 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-cf-muted uppercase">Credit Days</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={creditModal.creditDays}
                    onChange={(e) => setCreditModal(prev => prev ? { ...prev, creditDays: Math.max(0, parseInt(e.target.value) || 0) } : null)}
                    className="cf-input w-full mt-1 px-3 py-2.5 text-sm"
                  />
                </div>
                <div className="bg-[#171717] border border-white/10 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-cf-secondary">Available Credit</span><span className="text-[#d4af37] font-bold">{formatINR(Math.max(0, creditModal.creditLimit - creditModal.outstandingBalance))}</span></div>
                  <div className="flex justify-between"><span className="text-cf-secondary">Used Credit</span><span className="text-cf-primary">{formatINR(creditModal.outstandingBalance)}</span></div>
                </div>
                <button type="submit" disabled={savingCredit} className="w-full cf-btn-brand py-3 rounded-xl text-sm">
                  {savingCredit ? 'Saving...' : 'Save Credit Settings'}
                </button>
              </form>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Record Transaction</p>
                <form onSubmit={handleRecordPayment} className="bg-[#171717] border border-white/10 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-green-400">Payment Received</p>
                  <input
                    type="number"
                    min={1}
                    placeholder="Amount (₹)"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="cf-input w-full px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    className="cf-input w-full px-3 py-2 text-sm"
                  />
                  <button type="submit" disabled={recordingPayment} className="w-full py-2 text-xs font-semibold rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10">
                    {recordingPayment ? 'Recording...' : 'Record Payment'}
                  </button>
                </form>
                <form onSubmit={handleRecordCreditNote} className="bg-[#171717] border border-white/10 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-[#d4af37]">Credit Note</p>
                  <input
                    type="number"
                    min={1}
                    placeholder="Amount (₹)"
                    value={creditNoteAmount}
                    onChange={(e) => setCreditNoteAmount(e.target.value)}
                    className="cf-input w-full px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={creditNoteNote}
                    onChange={(e) => setCreditNoteNote(e.target.value)}
                    className="cf-input w-full px-3 py-2 text-sm"
                  />
                  <button type="submit" disabled={recordingCreditNote} className="w-full py-2 text-xs font-semibold rounded-lg border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/10">
                    {recordingCreditNote ? 'Recording...' : 'Record Credit Note'}
                  </button>
                </form>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-[10px] font-bold text-cf-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Wallet Ledger
              </p>
              <DealerLedger entries={creditModalLedger} loading={ledgerLoading} />
            </div>
          </div>
        </div>
      )}

      {/* Product Add/Edit Modal (Step 4) */}
      {productModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#222222] rounded-xl border border-white/10 max-w-2xl w-full p-6 space-y-4 shadow-2xl my-auto animate-fade-in max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Package className="w-5 h-5 text-zinc-400" />
                {productModal.mode === 'add' ? 'Add B2B Product' : 'Edit Catalog Attributes'}
              </h4>
              <button 
                type="button"
                onClick={() => setProductModal(null)}
                className="text-cf-muted hover:text-cf-primary transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Product Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Product Name *</label>
                  <input
                    required
                    type="text"
                    value={productModal.name || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="e.g. Royal Premium Executive Desk"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Product SKU */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Product SKU *</label>
                  <input
                    required
                    type="text"
                    value={productModal.sku || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, sku: e.target.value } : null)}
                    placeholder="e.g. CF-OFF-DK901"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Wholesale Category *</label>
                  <select
                    value={productModal.category || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, category: e.target.value } : null)}
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Wholesale Price */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Wholesale Price (INR) *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={productModal.wholesalePrice || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, wholesalePrice: Number(e.target.value) } : null)}
                    placeholder="INR Value"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Minimum Order Quantity */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Minimum Order Qty (MOQ) *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={productModal.minimumOrderQuantity || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, minimumOrderQuantity: Number(e.target.value) } : null)}
                    placeholder="e.g. 5 units"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Available Stock */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Available Stock *</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={productModal.availableStock === undefined ? '' : productModal.availableStock}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, availableStock: Number(e.target.value) } : null)}
                    placeholder="e.g. 15 items"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Material & Accent */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Material *</label>
                  <input
                    required
                    type="text"
                    value={productModal.material || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, material: e.target.value } : null)}
                    placeholder="e.g. Engineered Pine Wood"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Color Accent</label>
                  <input
                    type="text"
                    value={productModal.color || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, color: e.target.value } : null)}
                    placeholder="e.g. Walnut Brown"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Dimensions */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Dimensions *</label>
                  <input
                    required
                    type="text"
                    value={productModal.dimensions || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, dimensions: e.target.value } : null)}
                    placeholder="e.g. 72W x 36D x 30H"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Weight */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Weight (Kg)</label>
                  <input
                    type="text"
                    value={productModal.weight || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, weight: e.target.value } : null)}
                    placeholder="e.g. 45 Kg"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Size */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Size Segment</label>
                  <input
                    type="text"
                    value={productModal.size || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, size: e.target.value } : null)}
                    placeholder="e.g. Large / Adjustable"
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  />
                </div>

                {/* Shop Display Status */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">Stock Status *</label>
                  <select
                    value={productModal.status || 'Available'}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, status: e.target.value as 'Available' | 'Out Of Stock' } : null)}
                    className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
                  >
                    <option value="Available">Available</option>
                    <option value="Out Of Stock">Out Of Stock</option>
                  </select>
                </div>

              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider pb-1 block">Detailed Description *</label>
                <textarea
                  required
                  value={productModal.description || ''}
                  onChange={(e) => setProductModal(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Detail structural aspects, B2B wholesale warranty parameters, assembly guidance..."
                  rows={3}
                  className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white placeholder-zinc-500 rounded-lg focus:border-[#b65200] outline-none resize-none transition"
                />
              </div>

              {/* Dynamic Images (Multiple Images) */}
              <div className="space-y-2 border border-white/10 p-4 rounded-xl bg-[#171717]">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider block">
                    Product Images ({productModal.images ? productModal.images.length : 0})
                  </label>
                  <label className="cursor-pointer text-white hover:text-[#d4d4d8] text-[11px] font-bold transition flex items-center gap-1.5">
                    <Upload className="w-4 h-4" />
                    Upload with Firebase Storage
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleProductImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Multiple Images List */}
                <div className="grid grid-cols-6 gap-2 pt-2">
                  {productModal.images && productModal.images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square border border-white/10 rounded-lg bg-zinc-900 group overflow-hidden">
                      <img src={img} alt="Product preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setProductModal(prev => prev ? { ...prev, images: prev.images.filter((_, i) => i !== idx) } : null)}
                        className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150 text-[10px] font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {uploadingImages && (
                    <div className="aspect-square border border-dashed border-zinc-700 rounded-lg flex items-center justify-center animate-pulse">
                      <span className="text-[9px] text-cf-muted font-semibold text-center uppercase tracking-wider">Uploading...</span>
                    </div>
                  )}
                </div>

                {/* Preset Fast Image Adder Helper */}
                <div className="flex gap-1.5 pt-3 border-t border-white/10/45">
                  <input
                    id="new-manual-img-url"
                    type="text"
                    placeholder="Paste another external Image URL..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          setProductModal(prev => prev ? { ...prev, images: [...prev.images, val] } : null);
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                    className="grow text-[10px] p-2 bg-[#222222] border border-white/10 text-white rounded shadow-inner outline-none focus:border-[#b65200]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('new-manual-img-url') as HTMLInputElement;
                      const val = input?.value.trim();
                      if (val) {
                        setProductModal(prev => prev ? { ...prev, images: [...(prev.images || []), val] } : null);
                        input.value = '';
                      }
                    }}
                    className="py-1 px-3 bg-[#222222] border border-white/10 hover:bg-zinc-800 text-[10px] rounded font-bold text-white transition animate-pulse"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Design Sheets & Leaflet Brochures */}
              <div className="grid grid-cols-2 gap-3 border border-white/10 p-4 rounded-xl bg-[#171717]">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider block">
                    Furniture Design Sheet
                  </label>
                  {productModal.designSheetUrl ? (
                    <div className="flex items-center justify-between gap-1.5 p-2 bg-zinc-950 rounded border border-white/10">
                      <span className="text-[9px] text-[#10b981] font-mono truncate max-w-[110px]">{productModal.designSheetUrl}</span>
                      <button
                        type="button"
                        onClick={() => setProductModal(prev => prev ? { ...prev, designSheetUrl: undefined } : null)}
                        className="text-red-500 hover:text-red-400 text-[9px] font-bold uppercase"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer text-zinc-400 hover:text-white border border-dashed border-zinc-700 p-2.5 text-center rounded-lg block text-[10px] transition hover:border-zinc-500 bg-[#222222]/50">
                      {uploadingSheet ? 'Uploading...' : 'Upload Sheet (PDF/Img)'}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleDesignSheetUpload}
                        className="hidden"
                        disabled={uploadingSheet}
                      />
                    </label>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider block">
                    Product Brochure Leaflet
                  </label>
                  {productModal.brochureUrl ? (
                    <div className="flex items-center justify-between gap-1.5 p-2 bg-zinc-950 rounded border border-white/10">
                      <span className="text-[9px] text-[#10b981] font-mono truncate max-w-[110px]">{productModal.brochureUrl}</span>
                      <button
                        type="button"
                        onClick={() => setProductModal(prev => prev ? { ...prev, brochureUrl: undefined } : null)}
                        className="text-red-500 hover:text-red-400 text-[9px] font-bold uppercase"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer text-zinc-400 hover:text-white border border-dashed border-zinc-700 p-2.5 text-center rounded-lg block text-[10px] transition hover:border-zinc-500 bg-[#222222]/50">
                      {uploadingBrochure ? 'Uploading...' : 'Upload Brochure PDF'}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleBrochureUpload}
                        className="hidden"
                        disabled={uploadingBrochure}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Toggle instant B2B show */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="prod-active-checkbox"
                  checked={productModal.isActive !== false}
                  onChange={(e) => setProductModal(prev => prev ? { ...prev, isActive: e.target.checked } : null)}
                  className="w-4 h-4 accent-[#fafafa] rounded text-zinc-950 border-white/10 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="prod-active-checkbox" className="text-xs font-semibold text-white cursor-pointer">
                  Activate instantly on B2B Dealer Portal
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductModal(null)}
                  className="flex-1 py-3 bg-transparent hover:bg-[#171717] text-xs text-white rounded-lg border border-white/10 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-prod"
                  type="submit"
                  className="flex-1 py-3 bg-[#b65200] hover:bg-[#d66b0f] text-white rounded-lg text-xs font-bold transition shadow-md font-sans"
                >
                  Save Product specifications
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {confirmModal?.isOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-150">
          <div className="bg-[#222222] rounded-2xl border border-red-500/20 max-w-sm w-full p-6 space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-amber-500" />
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg text-red-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white leading-none">
                  {confirmModal.title}
                </h4>
                <p className="text-[11px] text-cf-secondary leading-relaxed pt-1">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 bg-transparent hover:bg-[#171717] text-xs text-white border border-white/10 rounded-xl font-bold transition duration-200 cursor-pointer"
              >
                No, Keep
              </button>
              <button
                id="btn-confirm-delete"
                type="button"
                onClick={async () => {
                  try {
                    await confirmModal.onConfirm();
                  } finally {
                    setConfirmModal(null);
                  }
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-xl font-bold transition duration-200 shadow-lg shadow-red-900/20 cursor-pointer"
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

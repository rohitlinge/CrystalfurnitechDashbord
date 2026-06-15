import React, { useState, useEffect } from 'react';
import { DBService } from '../firebase';
import { DealerProfile, DealerStatus, StockRequirement, CategoryItem, ProductItem } from '../types';
import { 
  Users, ClipboardList, CheckCircle, Ban, Hourglass, Trash2, 
  Search, RefreshCw, LogOut, ChevronRight, X, AlertTriangle, Info, ShieldCheck, Landmark,
  Layers, Package, Edit, Plus, Eye, EyeOff, Upload, Image as ImageIcon
} from 'lucide-react';

interface AdminDashboardProps {
  adminUser: DealerProfile;
  onLogout: () => void;
}

export default function AdminDashboard({ adminUser, onLogout }: AdminDashboardProps) {
  const [dealers, setDealers] = useState<DealerProfile[]>([]);
  const [requirements, setRequirements] = useState<StockRequirement[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [activeTab, setActiveTab] = useState<'dealers' | 'requirements' | 'categories' | 'products'>('dealers');
  const [loading, setLoading] = useState(false);
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
  } | null>(null);

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
      password: ''
    });
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
        password: dealerModal.password
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

  const handleUpdateRequirementStatus = async (reqId: string, nextStatus: 'Fulfilled' | 'Cancelled') => {
    try {
      await DBService.updateStockRequirementStatus(reqId, nextStatus);
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRequirement = (reqId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Stock Indent",
      message: "Are you sure you want to permanently delete this fulfilled or cancelled stock requirement record? This will remove it from historical listings permanently.",
      actionLabel: "Permanently Delete",
      onConfirm: async () => {
        try {
          await DBService.deleteStockRequirement(reqId);
          await fetchData();
        } catch (e) {
          console.error(e);
          alert("Failed to delete stock requirement.");
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
      alert("Please provide or upload at least one product image.");
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
      alert("Failed to upload image. Please try again.");
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
      alert("Failed to upload design sheet.");
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
      alert("Failed to upload brochure.");
    } finally {
      setUploadingBrochure(false);
    }
  };

  // Filter lists based on search
  const filteredDealers = dealers.filter(d => 
    d.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.gstNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRequirements = requirements.filter(r => 
    r.dealerCompanyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.material || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col text-[#fafafa]">
      
      {/* Top Admin Navbar */}
      <header className="bg-[#18181b] border-b border-[#27272a] text-[#fafafa] sticky top-0 z-10 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#27272a]/40 p-2.5 rounded-xl border border-[#27272a]">
              <ShieldCheck className="w-5 h-5 text-[#fafafa]" />
            </div>
            <div>
              <h1 id="admin-h1" className="font-serif italic text-lg sm:text-xl font-medium tracking-tight text-[#fafafa]">Crystal Furnitech</h1>
              <p id="admin-sub" className="text-[10px] text-[#a1a1aa] font-semibold tracking-wider uppercase">B2B Management Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <span className="text-[10px] text-[#a1a1aa] font-semibold block uppercase">Logged in as Owner</span>
              <span id="admin-name" className="text-xs font-semibold text-[#fafafa]">{adminUser.ownerName}</span>
            </div>
            <button 
              id="admin-logout-btn"
              onClick={onLogout}
              className="py-1.5 px-3 bg-transparent hover:bg-[#fafafa] hover:text-[#09090b] rounded-lg text-[#fafafa] text-xs font-medium cursor-pointer transition border border-[#27272a] flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Statistics Panels (Bento Elegant Style) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          
          <div className="bg-[#18181b] p-5 rounded-xl border border-[#27272a] flex items-center gap-4">
            <div className="p-3 bg-[#27272a]/40 text-[#a1a1aa] rounded-lg border border-[#27272a]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#a1a1aa] font-semibold block uppercase">All Dealers</span>
              <span className="text-2xl font-semibold text-[#fafafa]">{statusCounts.total}</span>
            </div>
          </div>

          <div className="bg-[#18181b] p-5 rounded-xl border border-[#27272a] flex items-center gap-4 border-l-2 border-l-[#f59e0b]">
            <div className="p-3 bg-[#f59e0b]/10 text-[#f59e0b] rounded-lg border border-[#f59e0b]/20">
              <Hourglass className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#f59e0b] font-semibold block uppercase">Pending</span>
              <span className="text-2xl font-semibold text-[#fafafa]">{statusCounts.pending}</span>
            </div>
          </div>

          <div className="bg-[#18181b] p-5 rounded-xl border border-[#27272a] flex items-center gap-4 border-l-2 border-l-[#10b981]">
            <div className="p-3 bg-[#10b981]/10 text-[#10b981] rounded-lg border border-[#10b981]/20">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#10b981] font-semibold block uppercase">Approved</span>
              <span className="text-2xl font-semibold text-[#fafafa]">{statusCounts.approved}</span>
            </div>
          </div>

          <div className="bg-[#18181b] p-5 rounded-xl border border-[#27272a] flex items-center gap-4 border-l-2 border-l-[#ef4444]">
            <div className="p-3 bg-[#ef4444]/10 text-[#ef4444] rounded-lg border border-[#ef4444]/20">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#ef4444] font-semibold block uppercase">Rejected</span>
              <span className="text-2xl font-semibold text-[#fafafa]">{statusCounts.rejected}</span>
            </div>
          </div>

          <div className="bg-[#18181b] p-5 rounded-xl border border-[#27272a] flex items-center gap-4 border-l-2 border-l-yellow-500 col-span-2 md:col-span-1">
            <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-lg border border-yellow-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-yellow-500 font-semibold block uppercase">Suspended</span>
              <span className="text-2xl font-semibold text-[#fafafa]">{statusCounts.suspended}</span>
            </div>
          </div>

        </div>

        {/* Tab Selection Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#18181b] p-4 rounded-xl border border-[#27272a]">
          
          <div className="flex flex-wrap gap-2 bg-[#09090b] p-1 border border-[#27272a] rounded-lg">
            <button
              id="tab-dealers"
              type="button"
              onClick={() => { setActiveTab('dealers'); setSearchTerm(''); }}
              className={`py-2 px-3 sm:px-4 rounded-md font-semibold text-[11px] sm:text-xs tracking-wide transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'dealers' 
                  ? 'bg-[#18181b] border border-[#27272a] text-[#fafafa] shadow-md' 
                  : 'text-[#a1a1aa] hover:text-[#fafafa]'
              }`}
            >
              <Users className="w-4 h-4" />
              Dealers ({dealers.length})
            </button>
            <button
              id="tab-requirements"
              type="button"
              onClick={() => { setActiveTab('requirements'); setSearchTerm(''); }}
              className={`py-2 px-3 sm:px-4 rounded-md font-semibold text-[11px] sm:text-xs tracking-wide transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'requirements' 
                  ? 'bg-[#18181b] border border-[#27272a] text-[#fafafa] shadow-md' 
                  : 'text-[#a1a1aa] hover:text-[#fafafa]'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Stock Requests ({requirements.length})
            </button>
            <button
              id="tab-categories"
              type="button"
              onClick={() => { setActiveTab('categories'); setSearchTerm(''); }}
              className={`py-2 px-3 sm:px-4 rounded-md font-semibold text-[11px] sm:text-xs tracking-wide transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'categories' 
                  ? 'bg-[#18181b] border border-[#27272a] text-[#fafafa] shadow-md' 
                  : 'text-[#a1a1aa] hover:text-[#fafafa]'
              }`}
            >
              <Layers className="w-4 h-4" />
              Categories ({categories.length})
            </button>
            <button
              id="tab-products"
              type="button"
              onClick={() => { setActiveTab('products'); setSearchTerm(''); }}
              className={`py-2 px-3 sm:px-4 rounded-md font-semibold text-[11px] sm:text-xs tracking-wide transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'products' 
                  ? 'bg-[#18181b] border border-[#27272a] text-[#fafafa] shadow-md' 
                  : 'text-[#a1a1aa] hover:text-[#fafafa]'
              }`}
            >
              <Package className="w-4 h-4" />
              Products ({products.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative grow sm:w-60">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
              <input 
                id="admin-search"
                type="text"
                placeholder={
                  activeTab === 'dealers' ? "Search dealers..." : 
                  activeTab === 'requirements' ? "Search stock requests..." :
                  activeTab === 'categories' ? "Search categories..." : 
                  "Search SKU, product material, color..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-3 text-xs bg-[#09090b] border border-[#27272a] text-[#fafafa] placeholder-zinc-500 rounded-lg focus:border-[#fafafa] outline-none transition"
              />
            </div>

            {/* Quick Action additions CTA based on tabs */}
            {activeTab === 'dealers' && (
              <button
                id="btn-add-dealer-cta"
                type="button"
                onClick={handleOpenAddDealer}
                className="py-3 px-4 bg-[#fafafa] hover:bg-[#d4d4d8] text-[#09090b] font-bold text-xs rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer hover:shadow-md"
              >
                <Plus className="w-4 h-4" /> Add Dealer
              </button>
            )}

            {activeTab === 'categories' && (
              <button
                id="btn-add-category-cta"
                type="button"
                onClick={handleOpenAddCategory}
                className="py-3 px-4 bg-[#fafafa] hover:bg-[#d4d4d8] text-[#09090b] font-bold text-xs rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer hover:shadow-md"
              >
                <Plus className="w-4 h-4" /> Add Category
              </button>
            )}

            {activeTab === 'products' && (
              <button
                id="btn-add-product-cta"
                type="button"
                onClick={handleOpenAddProduct}
                className="py-3 px-4 bg-[#fafafa] hover:bg-[#d4d4d8] text-[#09090b] font-bold text-xs rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer hover:shadow-md"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            )}

            {/* Refresh Trigger */}
            <button 
              id="btn-admin-refresh"
              type="button"
              onClick={fetchData}
              disabled={loading}
              title="Refresh Data List"
              className="p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] hover:bg-[#fafafa] hover:text-[#09090b] rounded-lg cursor-pointer transition duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

        </div>

        {/* Details and Lists Grid */}
        <div className="bg-[#18181b] rounded-xl border border-[#27272a] overflow-hidden">
          
          {activeTab === 'dealers' && (
            
            /* --- Dealers Management Tab Panel --- */
            <div className="overflow-x-auto min-w-full">
              <table className="min-w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950/40 border-b border-[#27272a] text-[#a1a1aa] uppercase font-bold tracking-wider">
                    <th className="py-4 px-5">Company Details</th>
                    <th className="py-4 px-5">Contact Details</th>
                    <th className="py-4 px-5">GST Identification</th>
                    <th className="py-4 px-5">City & State</th>
                    <th className="py-4 px-5">Registered On</th>
                    <th className="py-4 px-5">Status</th>
                    <th className="py-4 px-5 text-right">Backoffice Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a] text-[#a1a1aa]">
                   {filteredDealers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#a1a1aa] font-semibold">
                        <Users className="w-10 h-10 mx-auto text-[#27272a] mb-2" />
                        No dealer accounts match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDealers.map((dl) => (
                      <tr key={dl.uid} className="hover:bg-zinc-950/20 transition">
                        
                        {/* Company Detail Column */}
                        <td className="py-4 px-5">
                          <div>
                            <span className="font-semibold text-[#fafafa] block text-sm">{dl.companyName}</span>
                            <span className="text-[#a1a1aa] text-[10px] block font-medium mt-0.5">Owner: {dl.ownerName}</span>
                          </div>
                        </td>

                        {/* Contact Details */}
                        <td className="py-4 px-5">
                          <div className="space-y-0.5">
                            <span className="block font-medium text-zinc-300">{dl.email}</span>
                            <span className="block text-[#a1a1aa] text-[10px]">Mobile: +91 {dl.mobile}</span>
                          </div>
                        </td>

                        {/* GST Number */}
                        <td className="py-4 px-5 font-mono text-zinc-300 font-semibold uppercase">
                          {dl.gstNumber}
                        </td>

                        {/* City/State */}
                        <td className="py-4 px-5">
                          <div>
                            <span className="font-semibold text-zinc-300 block">{dl.city}</span>
                            <span className="text-[#a1a1aa] text-[10px] block">{dl.state}</span>
                          </div>
                        </td>

                        {/* Registration Date */}
                        <td className="py-4 px-5 text-zinc-400 whitespace-nowrap">
                          {new Date(dl.registrationDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
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
                                className="p-1.5 bg-transparent hover:bg-[#10b981] hover:text-black hover:border-transparent text-[#10b981] border border-[#27272a] rounded-lg cursor-pointer transition duration-200"
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
                                className="p-1.5 bg-transparent hover:bg-[#ef4444] hover:text-white hover:border-transparent text-[#ef4444] border border-[#27272a] rounded-lg cursor-pointer transition duration-200"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}

                            {/* Suspend action */}
                            {dl.status === 'Approved' && (
                              <button
                                id={`btn-suspend-${dl.uid}`}
                                type="button"
                                title="Suspend Account Privileges"
                                onClick={() => handleOpenReasonModal(dl.uid, dl.companyName, 'Suspend')}
                                className="p-1.5 bg-transparent hover:bg-yellow-500 hover:text-black hover:border-transparent text-yellow-500 border border-[#27272a] rounded-lg cursor-pointer transition duration-200"
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
                              className="p-1.5 bg-transparent hover:bg-[#ef4444] hover:text-white hover:border-transparent text-[#a1a1aa] border border-[#27272a] rounded-lg cursor-pointer transition duration-200"
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
            
            /* --- Wholesale Stock Requests Tab Panel --- */
            <div className="overflow-x-auto min-w-full">
              <table className="min-w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950/40 border-b border-[#27272a] text-[#a1a1aa] uppercase font-bold tracking-wider">
                    <th className="py-4 px-5">Partner Dealer</th>
                    <th className="py-4 px-5">Product Details</th>
                    <th className="py-4 px-5 text-center">Qty / Indent</th>
                    <th className="py-4 px-5">Sourcing Value</th>
                    <th className="py-4 px-5">Date Posted</th>
                    <th className="py-4 px-5">Deal Status</th>
                    <th className="py-4 px-5 text-right">Fulfillment Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a] text-[#a1a1aa]">
                  {filteredRequirements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#a1a1aa] font-semibold">
                        <ClipboardList className="w-10 h-10 mx-auto text-[#27272a] mb-2" />
                        No wholesale stock requests found.
                      </td>
                    </tr>
                  ) : (
                    filteredRequirements.map((rq) => {
                      const totalEstimatedVal = rq.quantityRequested * 15000; // estimated wholesale rate

                      return (
                        <tr key={rq.id} className="hover:bg-zinc-950/20 transition">
                          
                          {/* Dealer Company */}
                          <td className="py-4 px-5">
                            <div>
                              <span className="font-semibold text-[#fafafa] block text-sm">{rq.dealerCompanyName}</span>
                              <span className="text-[10px] text-zinc-400 font-semibold block mt-0.5">Dealer Ref: {rq.dealerId.substring(0, 8)}...</span>
                            </div>
                          </td>

                          {/* Product requested info */}
                          <td className="py-4 px-5">
                            <div>
                              <span className="font-semibold text-zinc-300 block text-xs">{rq.productName}</span>
                              <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">ID: {rq.productId}</span>
                              {rq.notes && (
                                <p className="text-[10px] text-zinc-400 italic mt-1 bg-[#09090b] border border-[#27272a] p-1 rounded font-sans max-w-xs whitespace-normal">
                                  "{rq.notes}"
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="py-4 px-5 text-center font-bold text-[#fafafa] text-sm">
                            {rq.quantityRequested} units
                          </td>

                          {/* Est Stock Value */}
                          <td className="py-4 px-5 font-mono font-semibold text-[#fafafa]">
                            ₹{(totalEstimatedVal).toLocaleString('en-IN')}
                          </td>

                          {/* Date request */}
                          <td className="py-4 px-5 text-zinc-400 whitespace-nowrap">
                            {new Date(rq.requestedDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-5">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              rq.status === 'Fulfilled'
                                ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20'
                                : rq.status === 'Cancelled'
                                ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20'
                                : 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 animate-pulse'
                            }`}>
                              {rq.status}
                            </span>
                          </td>

                          {/* Backoffice updates for Stock requests */}
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            {rq.status === 'Pending' ? (
                              <div className="flex justify-end gap-1.5">
                                <button
                                  id={`btn-fulfill-${rq.id}`}
                                  type="button"
                                  onClick={() => handleUpdateRequirementStatus(rq.id, 'Fulfilled')}
                                  className="py-1 px-2.5 bg-transparent hover:bg-[#10b981]/20 hover:text-[#10b981] border border-[#27272a] text-[#fafafa] font-semibold text-[10px] rounded-lg transition"
                                >
                                  Fulfill Request
                                </button>
                                <button
                                  id={`btn-cancel-${rq.id}`}
                                  type="button"
                                  onClick={() => handleUpdateRequirementStatus(rq.id, 'Cancelled')}
                                  className="py-1 px-2.5 bg-transparent hover:bg-[#ef4444]/20 hover:text-[#ef4444] border border-[#27272a] text-[#ef4444] font-semibold text-[10px] rounded-lg transition"
                                >
                                  Reject/Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end items-center gap-2">
                                <span className="text-[10px] text-zinc-500 font-medium">Completed</span>
                                <button
                                  id={`btn-delete-req-${rq.id}`}
                                  type="button"
                                  onClick={() => handleDeleteRequirement(rq.id)}
                                  className="p-1 px-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-[#27272a] hover:border-red-500/20 rounded-lg transition flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                                  title="Delete Requirement Record"
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
              <table className="min-w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950/40 border-b border-[#27272a] text-[#a1a1aa] uppercase font-bold tracking-wider">
                    <th className="py-4 px-5">Category Name</th>
                    <th className="py-4 px-5">Description</th>
                    <th className="py-4 px-5">Date Created</th>
                    <th className="py-4 px-5">Status</th>
                    <th className="py-4 px-5 text-right">Backoffice CRM Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a] text-[#a1a1aa]">
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#a1a1aa] font-semibold">
                        <Layers className="w-10 h-10 mx-auto text-[#27272a] mb-2" />
                        No categories found. Click 'Add Category' to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-zinc-950/20 transition">
                        
                        {/* Category Name */}
                        <td className="py-4 px-5">
                          <span className="font-semibold text-[#fafafa] block text-sm">{cat.name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">ID: {cat.id}</span>
                        </td>

                        {/* Description */}
                        <td className="py-4 px-5 max-w-xs whitespace-normal text-zinc-300 font-sans">
                          {cat.description || <span className="text-zinc-650 italic">No description provided</span>}
                        </td>

                        {/* Date Created */}
                        <td className="py-4 px-5 text-zinc-400 font-mono font-medium">
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
                              className={`p-1.5 border border-[#27272a] rounded-lg cursor-pointer transition ${
                                cat.isActive 
                                  ? 'hover:bg-yellow-500/20 text-yellow-500 hover:text-yellow-400' 
                                  : 'hover:bg-[#10b981]/20 text-zinc-450 hover:text-[#10b981]'
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
                              className="p-1.5 bg-transparent hover:bg-zinc-850 hover:text-white text-[#fafafa] border border-[#27272a] rounded-lg cursor-pointer transition duration-200"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button
                              id={`btn-delete-cat-${cat.id}`}
                              type="button"
                              title="Delete Category"
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              className="p-1.5 bg-transparent hover:bg-[#ef4444] hover:text-white text-[#ef4444] border border-[#27272a] rounded-lg cursor-pointer transition duration-200"
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
              <table className="min-w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950/40 border-b border-[#27272a] text-[#a1a1aa] uppercase font-bold tracking-wider">
                    <th className="py-4 px-5">Product Details</th>
                    <th className="py-4 px-5">Category & SKU</th>
                    <th className="py-4 px-5">Wholesale Price</th>
                    <th className="py-4 px-5">Inventory Stock & Status</th>
                    <th className="py-4 px-5">Created Date</th>
                    <th className="py-4 px-5 text-right">Backoffice CRM Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a] text-[#a1a1aa]">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#a1a1aa] font-semibold">
                        <Package className="w-10 h-10 mx-auto text-[#27272a] mb-2" />
                        No product items found. Click 'Add Product' to establish a B2B catalog item.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const allPics = p.images || (p.image ? [p.image] : []);
                      return (
                        <tr key={p.id} className="hover:bg-zinc-950/20 transition">
                          
                          {/* Rich Product Detail layout */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className="relative w-12 h-12 rounded-lg border border-[#27272a] overflow-hidden bg-zinc-900 flex-shrink-0">
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
                                <span className="font-semibold text-[#fafafa] block text-sm leading-tight">{p.name}</span>
                                <span className="text-[10px] text-zinc-400 block mt-1">{p.material} &bull; {p.color || 'No color spec'}</span>
                              </div>
                            </div>
                          </td>

                          {/* Category & SKU */}
                          <td className="py-4 px-5">
                            <div>
                              <span className="text-zinc-300 block font-semibold">{p.category}</span>
                              <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">SKU: {p.sku}</span>
                            </div>
                          </td>

                          {/* Price details */}
                          <td className="py-4 px-5 font-mono text-xs font-semibold text-[#fafafa]">
                            <div>
                              <span className="text-sm">₹{(p.wholesalePrice || p.price).toLocaleString('en-IN')}</span>
                              <span className="text-[9px] text-zinc-500 block font-semibold mt-0.5">MOQ: {p.minimumOrderQuantity || 1} units</span>
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
                              <span className="text-[10px] text-zinc-450 block mt-1 font-semibold">{p.availableStock} items in shop</span>
                            </div>
                          </td>

                          {/* Created Date */}
                          <td className="py-4 px-5 text-zinc-400 font-mono font-medium">
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
                                className={`p-1.5 border border-[#27272a] rounded-lg cursor-pointer transition ${
                                  p.isActive !== false 
                                    ? 'hover:bg-yellow-500/20 text-yellow-500 hover:text-yellow-400' 
                                    : 'hover:bg-[#10b981]/20 text-zinc-450 hover:text-[#10b981]'
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
                                className="p-1.5 bg-transparent hover:bg-zinc-850 hover:text-white text-[#fafafa] border border-[#27272a] rounded-lg cursor-pointer transition duration-200"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* Delete catalog item */}
                              <button
                                id={`btn-delete-prod-${p.id}`}
                                type="button"
                                title="Delete Product permanently"
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                className="p-1.5 bg-transparent hover:bg-[#ef4444] hover:text-white text-[#ef4444] border border-[#27272a] rounded-lg cursor-pointer transition duration-200"
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

      </main>

      {/* FOOTER */}
      <footer className="shrink-0 bg-[#09090b] border-t border-[#27272a] py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-[#a1a1aa]">
          📍 Crystal Furnitech Backoffice Hub Admin Controls. Secure relational transaction ledger active.
        </div>
      </footer>

      {/* Reject / Suspend Feedback reason modal (Zero-dependency custom implementation) */}
      {reasonModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#18181b] rounded-xl border border-[#27272a] max-w-sm w-full p-6 space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#fafafa] flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
                Reason for Status Change
              </h4>
              <button 
                type="button"
                onClick={() => setReasonModal(null)}
                className="text-[#a1a1aa] hover:text-[#fafafa] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[#a1a1aa] leading-relaxed">
              Define the feedback reasons for <strong className="text-[#fafafa]">{reasonModal.companyName}</strong>. This custom message is displayed instantly on their login block.
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#a1a1aa]">Detailed Feedback Reason</label>
              <textarea
                value={feedbackReasonText}
                onChange={(e) => setFeedbackReasonText(e.target.value)}
                placeholder={reasonModal.actionType === 'Reject' 
                  ? "e.g. Invalid GST registration parameters submitted for the Maharashtra region."
                  : "e.g. Accounts frozen pending statutory wholesale registration updates."
                }
                rows={3}
                className="w-full text-xs p-2.5 bg-[#09090b] border border-[#27272a] text-[#fafafa] placeholder-zinc-500 rounded-lg focus:border-[#fafafa] outline-none resize-none transition"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="flex-1 py-2 bg-transparent hover:bg-[#27272a] text-xs text-[#fafafa] rounded-lg border border-[#27272a] font-semibold transition"
              >
                Go Back
              </button>
              <button
                id="btn-confirm-reason-change"
                type="button"
                onClick={handleConfirmReasonModal}
                className="flex-1 py-2 bg-[#fafafa] hover:bg-[#a1a1aa] text-[#09090b] rounded-lg text-xs font-semibold transition shadow-md"
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
          <div className="bg-[#18181b] rounded-xl border border-[#27272a] max-w-sm w-full p-6 space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
              <h4 className="text-sm font-bold text-[#fafafa] flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="w-5 h-5 text-zinc-400" />
                {categoryModal.mode === 'add' ? 'Create New Category' : 'Edit Category'}
              </h4>
              <button 
                type="button"
                onClick={() => setCategoryModal(null)}
                className="text-[#a1a1aa] hover:text-[#fafafa] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Category Name *</label>
                <input
                  required
                  type="text"
                  value={categoryModal.name}
                  onChange={(e) => setCategoryModal(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="e.g. TV Unit Furniture"
                  className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Description (Optional)</label>
                <textarea
                  value={categoryModal.description}
                  onChange={(e) => setCategoryModal(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Describe items under this collection..."
                  rows={3}
                  className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] placeholder-zinc-500 rounded-lg focus:border-[#fafafa] outline-none resize-none transition"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="cat-active-checkbox"
                  checked={categoryModal.isActive}
                  onChange={(e) => setCategoryModal(prev => prev ? { ...prev, isActive: e.target.checked } : null)}
                  className="w-4 h-4 accent-[#fafafa] rounded text-zinc-950 border-[#27272a] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="cat-active-checkbox" className="text-xs font-semibold text-[#fafafa] cursor-pointer">
                  Activate instantly for B2B cataloging
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryModal(null)}
                  className="flex-1 py-3 bg-transparent hover:bg-[#27272a] text-xs text-[#fafafa] rounded-lg border border-[#27272a] font-bold transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-cat"
                  type="submit"
                  className="flex-1 py-3 bg-[#fafafa] hover:bg-[#d4d4d8] text-[#09090b] rounded-lg text-xs font-bold transition shadow-md"
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
          <div className="bg-[#18181b] rounded-xl border border-[#27272a] max-w-xl w-full p-6 space-y-4 shadow-2xl my-auto animate-fade-in max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
              <h4 className="text-sm font-bold text-[#fafafa] flex items-center gap-1.5 uppercase tracking-wider">
                <Users className="w-5 h-5 text-zinc-400" />
                Add New Dealer Partner
              </h4>
              <button 
                type="button"
                onClick={() => setDealerModal(null)}
                className="text-[#a1a1aa] hover:text-[#fafafa] transition cursor-pointer"
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
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Company Name *</label>
                  <input
                    required
                    type="text"
                    value={dealerModal.companyName}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, companyName: e.target.value } : null)}
                    placeholder="e.g. Furnitech Enterprises"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Owner Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Owner Name *</label>
                  <input
                    required
                    type="text"
                    value={dealerModal.ownerName}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, ownerName: e.target.value } : null)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Email Address *</label>
                  <input
                    required
                    type="email"
                    value={dealerModal.email}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, email: e.target.value } : null)}
                    placeholder="rajesh@furnitech.com"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Mobile Number */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Mobile Number (+91) *</label>
                  <input
                    required
                    type="tel"
                    pattern="[0-9]{10}"
                    value={dealerModal.mobile}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, mobile: e.target.value.replace(/\D/g, '').substring(0, 10) } : null)}
                    placeholder="10-digit mobile number"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* GST Number */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">GST Number (Optional)</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={dealerModal.gstNumber}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, gstNumber: e.target.value.toUpperCase() } : null)}
                    placeholder="e.g. 27AAAAA1111A1Z1"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* City */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">City</label>
                  <input
                    type="text"
                    value={dealerModal.city}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, city: e.target.value } : null)}
                    placeholder="e.g. Mumbai"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* State */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">State</label>
                  <input
                    type="text"
                    value={dealerModal.state}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, state: e.target.value } : null)}
                    placeholder="e.g. Maharashtra"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Log-in Password *</label>
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={dealerModal.password}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, password: e.target.value } : null)}
                    placeholder="Minimum 6 characters"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Complete Address */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Registered Address</label>
                  <textarea
                    value={dealerModal.address}
                    onChange={(e) => setDealerModal(prev => prev ? { ...prev, address: e.target.value } : null)}
                    placeholder="Detailed warehouse or office coordinates..."
                    rows={2}
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] placeholder-zinc-500 rounded-lg focus:border-[#fafafa] outline-none resize-none transition"
                  />
                </div>

              </div>

              <div className="flex gap-2.5 pt-3 border-t border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setDealerModal(null)}
                  className="flex-1 py-3 bg-transparent hover:bg-[#27272a] text-xs text-[#fafafa] rounded-lg border border-[#27272a] font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-new-dealer"
                  type="submit"
                  disabled={addingDealer}
                  className="flex-1 py-3 bg-[#fafafa] hover:bg-[#d4d4d8] disabled:bg-[#27272a] disabled:text-[#a1a1aa] text-[#09090b] rounded-lg text-xs font-bold transition shadow-md flex items-center justify-center gap-1 cursor-pointer"
                >
                  {addingDealer && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {addingDealer ? 'Creating Account...' : 'Register Dealer'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Product Add/Edit Modal (Step 4) */}
      {productModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#18181b] rounded-xl border border-[#27272a] max-w-2xl w-full p-6 space-y-4 shadow-2xl my-auto animate-fade-in max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
              <h4 className="text-sm font-bold text-[#fafafa] flex items-center gap-1.5 uppercase tracking-wider">
                <Package className="w-5 h-5 text-zinc-400" />
                {productModal.mode === 'add' ? 'Add B2B Product' : 'Edit Catalog Attributes'}
              </h4>
              <button 
                type="button"
                onClick={() => setProductModal(null)}
                className="text-[#a1a1aa] hover:text-[#fafafa] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Product Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Product Name *</label>
                  <input
                    required
                    type="text"
                    value={productModal.name || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="e.g. Royal Premium Executive Desk"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Product SKU */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Product SKU *</label>
                  <input
                    required
                    type="text"
                    value={productModal.sku || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, sku: e.target.value } : null)}
                    placeholder="e.g. CF-OFF-DK901"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Wholesale Category *</label>
                  <select
                    value={productModal.category || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, category: e.target.value } : null)}
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Wholesale Price */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Wholesale Price (INR) *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={productModal.wholesalePrice || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, wholesalePrice: Number(e.target.value) } : null)}
                    placeholder="INR Value"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Minimum Order Quantity */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Minimum Order Qty (MOQ) *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={productModal.minimumOrderQuantity || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, minimumOrderQuantity: Number(e.target.value) } : null)}
                    placeholder="e.g. 5 units"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Available Stock */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Available Stock *</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={productModal.availableStock === undefined ? '' : productModal.availableStock}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, availableStock: Number(e.target.value) } : null)}
                    placeholder="e.g. 15 items"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Material & Accent */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Material *</label>
                  <input
                    required
                    type="text"
                    value={productModal.material || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, material: e.target.value } : null)}
                    placeholder="e.g. Engineered Pine Wood"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Color Accent</label>
                  <input
                    type="text"
                    value={productModal.color || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, color: e.target.value } : null)}
                    placeholder="e.g. Walnut Brown"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Dimensions */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Dimensions *</label>
                  <input
                    required
                    type="text"
                    value={productModal.dimensions || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, dimensions: e.target.value } : null)}
                    placeholder="e.g. 72W x 36D x 30H"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Weight */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Weight (Kg)</label>
                  <input
                    type="text"
                    value={productModal.weight || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, weight: e.target.value } : null)}
                    placeholder="e.g. 45 Kg"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Size */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Size Segment</label>
                  <input
                    type="text"
                    value={productModal.size || ''}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, size: e.target.value } : null)}
                    placeholder="e.g. Large / Adjustable"
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                </div>

                {/* Shop Display Status */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">Stock Status *</label>
                  <select
                    value={productModal.status || 'Available'}
                    onChange={(e) => setProductModal(prev => prev ? { ...prev, status: e.target.value as 'Available' | 'Out Of Stock' } : null)}
                    className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  >
                    <option value="Available">Available</option>
                    <option value="Out Of Stock">Out Of Stock</option>
                  </select>
                </div>

              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider pb-1 block">Detailed Description *</label>
                <textarea
                  required
                  value={productModal.description || ''}
                  onChange={(e) => setProductModal(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Detail structural aspects, B2B wholesale warranty parameters, assembly guidance..."
                  rows={3}
                  className="w-full text-xs p-3 bg-[#09090b] border border-[#27272a] text-[#fafafa] placeholder-zinc-500 rounded-lg focus:border-[#fafafa] outline-none resize-none transition"
                />
              </div>

              {/* Dynamic Images (Multiple Images) */}
              <div className="space-y-2 border border-[#27272a] p-4 rounded-xl bg-[#09090b]">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider block">
                    Product Images ({productModal.images ? productModal.images.length : 0})
                  </label>
                  <label className="cursor-pointer text-[#fafafa] hover:text-[#d4d4d8] text-[11px] font-bold transition flex items-center gap-1.5">
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
                    <div key={idx} className="relative aspect-square border border-[#27272a] rounded-lg bg-zinc-900 group overflow-hidden">
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
                      <span className="text-[9px] text-[#a1a1aa] font-semibold text-center uppercase tracking-wider">Uploading...</span>
                    </div>
                  )}
                </div>

                {/* Preset Fast Image Adder Helper */}
                <div className="flex gap-1.5 pt-3 border-t border-[#27272a]/45">
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
                    className="grow text-[10px] p-2 bg-[#18181b] border border-[#27272a] text-[#fafafa] rounded shadow-inner outline-none focus:border-[#fafafa]"
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
                    className="py-1 px-3 bg-[#18181b] border border-[#27272a] hover:bg-zinc-800 text-[10px] rounded font-bold text-white transition animate-pulse"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Design Sheets & Leaflet Brochures */}
              <div className="grid grid-cols-2 gap-3 border border-[#27272a] p-4 rounded-xl bg-[#09090b]">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider block">
                    Furniture Design Sheet
                  </label>
                  {productModal.designSheetUrl ? (
                    <div className="flex items-center justify-between gap-1.5 p-2 bg-zinc-950 rounded border border-[#27272a]">
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
                    <label className="cursor-pointer text-zinc-400 hover:text-white border border-dashed border-zinc-700 p-2.5 text-center rounded-lg block text-[10px] transition hover:border-zinc-500 bg-[#18181b]/50">
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
                  <label className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider block">
                    Product Brochure Leaflet
                  </label>
                  {productModal.brochureUrl ? (
                    <div className="flex items-center justify-between gap-1.5 p-2 bg-zinc-950 rounded border border-[#27272a]">
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
                    <label className="cursor-pointer text-zinc-400 hover:text-white border border-dashed border-zinc-700 p-2.5 text-center rounded-lg block text-[10px] transition hover:border-zinc-500 bg-[#18181b]/50">
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
                  className="w-4 h-4 accent-[#fafafa] rounded text-zinc-950 border-[#27272a] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="prod-active-checkbox" className="text-xs font-semibold text-[#fafafa] cursor-pointer">
                  Activate instantly on B2B Dealer Portal
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductModal(null)}
                  className="flex-1 py-3 bg-transparent hover:bg-[#27272a] text-xs text-[#fafafa] rounded-lg border border-[#27272a] font-bold transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-prod"
                  type="submit"
                  className="flex-1 py-3 bg-[#fafafa] hover:bg-[#d4d4d8] text-[#09090b] rounded-lg text-xs font-bold transition shadow-md font-sans"
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
          <div className="bg-[#18181b] rounded-2xl border border-red-500/20 max-w-sm w-full p-6 space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-amber-500" />
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg text-red-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#fafafa] leading-none">
                  {confirmModal.title}
                </h4>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed pt-1">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 bg-transparent hover:bg-[#27272a] text-xs text-[#fafafa] border border-[#27272a] rounded-xl font-bold transition duration-200 cursor-pointer"
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
  );
}

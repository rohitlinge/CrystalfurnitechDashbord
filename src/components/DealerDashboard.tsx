import React, { useState, useEffect } from 'react';
import { DBService } from '../firebase';
import { DealerProfile, ProductItem, StockRequirement, CategoryItem, LedgerEntry } from '../types';
import { getDealerCreditInfo, formatINR } from '../credit';
import DealerLedger from './DealerLedger';
import BrandLogo from './BrandLogo';
import Toast, { ToastMessage } from './Toast';
import OrderProgress from './OrderProgress';
import {
  canDealerCancel,
  isActiveOrder,
  orderStatusBadgeClass,
  orderStatusLabel,
} from '../orders';
import {
  Search, LogOut, Package2, ClipboardList, User, ShoppingCart, RefreshCw,
  CheckCircle, X, FileText, Download, AlertTriangle, Landmark, BookOpen
} from 'lucide-react';

interface DealerDashboardProps {
  dealerUser: DealerProfile;
  onLogout: () => void;
}

type DealerTab = 'catalog' | 'orders' | 'wallet' | 'account';

const tabLabels: Record<DealerTab, string> = {
  catalog: 'Product Catalog',
  orders: 'My Orders',
  wallet: 'Wallet & Ledger',
  account: 'My Account',
};

export default function DealerDashboard({ dealerUser, onLogout }: DealerDashboardProps) {
  const [profile, setProfile] = useState(dealerUser);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (message: string, type: ToastMessage['type'] = 'error') =>
    setToast({ id: Date.now(), message, type });

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [myRequirements, setMyRequirements] = useState<StockRequirement[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<DealerTab>('catalog');

  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [requestQty, setRequestQty] = useState(5);
  const [requestNotes, setRequestNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const refreshed = await DBService.refreshUserProfile();
      if (refreshed) setProfile(refreshed);

      const [catList, prodList, reqList] = await Promise.all([
        DBService.getCategories(),
        DBService.getProducts(),
        DBService.getStockRequirements(dealerUser.uid),
      ]);
      setCategories(catList);
      setProducts(prodList);
      setMyRequirements(reqList);

      try {
        const ledgerList = await DBService.getDealerLedger(dealerUser.uid);
        setLedgerEntries(ledgerList);
      } catch (ledgerErr) {
        setLedgerEntries([]);
        const ledgerMsg = ledgerErr instanceof Error ? ledgerErr.message : 'Failed to load wallet ledger.';
        console.error(ledgerErr);
        if (activeTab === 'wallet') {
          showToast(ledgerMsg);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load dashboard data.';
      console.error(e);
      showToast(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setProfile(dealerUser);
  }, [dealerUser]);

  useEffect(() => {
    fetchData();
  }, [dealerUser.uid]);

  const credit = getDealerCreditInfo(profile);
  const selectedUnitPrice = selectedProduct ? (selectedProduct.wholesalePrice || selectedProduct.price) : 0;
  const selectedOrderValue = selectedUnitPrice * requestQty;
  const exceedsCredit = selectedProduct ? selectedOrderValue > credit.availableCredit : false;

  const handleSubmitRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (requestQty < 1) {
      showToast('Please request at least 1 unit.', 'info');
      return;
    }
    if (requestQty > selectedProduct.availableStock) {
      showToast(`Only ${selectedProduct.availableStock} units available.`, 'info');
      return;
    }
    if (selectedOrderValue > credit.availableCredit) {
      showToast('Order cannot be placed', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await DBService.submitStockRequirement({
        dealerId: dealerUser.uid,
        dealerCompanyName: dealerUser.companyName,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantityRequested: requestQty,
        notes: requestNotes,
      });
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setSelectedProduct(null);
        setRequestQty(5);
        setRequestNotes('');
        setActiveTab('orders');
        fetchData();
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit indent.';
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequirement = (reqId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancel Stock Indent',
      message: 'Cancel this pending stock indent request?',
      actionLabel: 'Yes, Cancel',
      onConfirm: async () => {
        await DBService.updateOrderStatus(reqId, 'Cancelled');
        await fetchData();
      },
    });
  };

  const activeCategoryNames = [...new Set(categories.filter((c) => c.isActive !== false).map((c) => c.name))];
  const activeProducts = products.filter((p) => p.isActive !== false);
  const categoryFilterOptions =
    activeCategoryNames.length > 0 ? activeCategoryNames : [...new Set(activeProducts.map((p) => p.category).filter(Boolean))];
  const categoryTabs = ['All', ...categoryFilterOptions];

  const filteredProducts = activeProducts.filter((p) => {
    const q = (searchTerm || '').toLowerCase();
    const matchesSearch =
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.material || '').toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const activeOrderCount = myRequirements.filter((r) => isActiveOrder(r.status)).length;

  const navItems: { id: DealerTab; label: string; icon: typeof Package2; badge?: number }[] = [
    { id: 'catalog', label: 'Catalog', icon: Package2 },
    { id: 'orders', label: 'Orders', icon: ClipboardList, badge: activeOrderCount || undefined },
    { id: 'wallet', label: 'Wallet', icon: BookOpen },
    { id: 'account', label: 'Account', icon: User },
  ];

  const statusBadgeClass = (status: StockRequirement['status']) => orderStatusBadgeClass(status);

  const renderProductCard = (p: ProductItem) => (
    <article className="cf-product-card h-full">
      <div className="flex gap-3 p-3 lg:flex-col lg:p-0">
        <div className="w-24 h-24 lg:w-full lg:h-40 rounded-lg lg:rounded-none lg:rounded-t-xl overflow-hidden bg-[#171717] shrink-0 ring-1 ring-white/5 lg:ring-0">
          <img
            src={p.image}
            alt={p.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 lg:p-4">
          <div>
            <p className="text-[10px] font-semibold text-[#d4af37] uppercase tracking-wide">{p.category}</p>
            <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">{p.name}</h3>
            <p className="text-xs text-cf-muted font-mono mt-0.5">{p.sku}</p>
          </div>
          <div className="flex items-end justify-between mt-2 gap-2">
            <div>
              <p className="text-base font-bold text-white">₹{(p.wholesalePrice || p.price).toLocaleString('en-IN')}</p>
              <p className={`text-[10px] font-semibold ${
                p.availableStock === 0 ? 'text-red-400' : p.availableStock <= 5 ? 'text-[#d66b0f]' : 'text-green-400'
              }`}>
                {p.availableStock === 0 ? 'Out of stock' : `${p.availableStock} in stock`}
              </p>
            </div>
            <button
              type="button"
              disabled={p.availableStock === 0}
              onClick={() => {
                setSelectedProduct(p);
                setRequestQty(Math.min(5, p.availableStock || 1));
                setRequestNotes('');
                setSubmitSuccess(false);
              }}
              className="cf-btn-brand px-3 py-2 rounded-lg text-xs flex items-center gap-1 disabled:opacity-40 shrink-0"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Indent
            </button>
          </div>
        </div>
      </div>
    </article>
  );

  const renderOrderCard = (req: StockRequirement) => (
    <div key={req.id} className="cf-product-card p-4 space-y-3">
      <div className="flex justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{req.productName}</h3>
          <p className="text-[10px] text-cf-muted font-mono">{req.id}</p>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadgeClass(req.status)}`}>
          {orderStatusLabel(req.status)}
        </span>
      </div>
      <OrderProgress status={req.status} className="mb-1" />
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-cf-muted">Quantity</p>
          <p className="font-bold text-white">{req.quantityRequested} units</p>
        </div>
        <div>
          <p className="text-cf-muted">Value</p>
          <p className="font-bold text-[#d4af37]">{formatINR(req.orderValue || 0)}</p>
        </div>
        <div>
          <p className="text-cf-muted">Date</p>
          <p className="font-medium text-white">
            {new Date(req.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>
      {req.notes && <p className="text-xs text-cf-secondary italic border-t border-white/10 pt-2">"{req.notes}"</p>}
      {canDealerCancel(req.status) && (
        <button
          type="button"
          onClick={() => handleCancelRequirement(req.id)}
          className="w-full py-2 text-xs font-semibold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition"
        >
          Cancel Request
        </button>
      )}
    </div>
  );

  const creditSummaryCards = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
      <div className="bg-[#171717] rounded-lg p-3 border border-white/10">
        <p className="text-cf-muted">Credit Limit</p>
        <p className="text-white font-bold mt-1">{formatINR(credit.creditLimit)}</p>
      </div>
      <div className="bg-[#171717] rounded-lg p-3 border border-white/10">
        <p className="text-cf-muted">Used Credit</p>
        <p className="text-white font-bold mt-1">{formatINR(credit.usedCredit)}</p>
      </div>
      <div className="bg-[#171717] rounded-lg p-3 border border-white/10">
        <p className="text-cf-muted">Available Credit</p>
        <p className="text-[#d4af37] font-bold mt-1">{formatINR(credit.availableCredit)}</p>
      </div>
      <div className="bg-[#171717] rounded-lg p-3 border border-white/10">
        <p className="text-cf-muted">Outstanding</p>
        <p className="text-white font-bold mt-1">{formatINR(credit.outstandingBalance)}</p>
      </div>
    </div>
  );

  return (
    <div className="cf-dealer min-h-screen flex">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Desktop sidebar */}
      <aside className="cf-dealer-sidebar hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen border-r border-white/10">
        <div className="p-5 border-b border-white/10 flex flex-col items-center gap-1.5">
          <BrandLogo size="md" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-cf-muted">Dealer Portal</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                activeTab === id ? 'cf-dealer-nav-active' : 'text-white/70 cf-dealer-nav-item'
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </span>
              {badge ? (
                <span className={`text-xs px-1.5 py-0.5 rounded-md ${activeTab === id ? 'bg-black/20' : 'bg-[#222222]/30'}`}>
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="bg-[#171717] rounded-lg p-3 border border-[#d4af37]/20 text-xs">
            <p className="text-cf-muted uppercase tracking-wider text-[10px]">Available Credit</p>
            <p className="text-[#d4af37] font-bold text-lg mt-0.5">{formatINR(credit.availableCredit)}</p>
            <p className="text-cf-muted mt-1">{credit.creditDays} day payment terms</p>
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Logged in</p>
            <p className="text-sm font-semibold text-white truncate">{profile.companyName}</p>
            <p className="text-xs text-cf-muted truncate">{profile.ownerName}</p>
          </div>
          <button
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
        {/* Mobile header */}
        <header className="lg:hidden cf-dealer-header sticky top-0 z-20 pl-4 pr-14 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BrandLogo size="sm" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-cf-muted truncate">Dealer Portal</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-lg border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#b65200]/20 transition"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 lg:py-6 space-y-4 lg:space-y-6 max-w-lg lg:max-w-none mx-auto lg:mx-0">
          {/* Desktop page header */}
          <div className="hidden lg:flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h1 className="text-2xl font-semibold text-white">{tabLabels[activeTab]}</h1>
              <p className="text-sm text-cf-secondary">{profile.companyName} · {profile.city}, {profile.state}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-xs hidden xl:block">
                <p className="text-cf-muted">Outstanding</p>
                <p className="text-white font-bold">{formatINR(credit.outstandingBalance)}</p>
              </div>
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="p-2.5 rounded-lg border border-[#d4af37]/30 bg-[#222222] hover:border-[#d4af37] transition"
                aria-label="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 text-[#d4af37] ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {activeTab === 'catalog' && (
            <>
              <div className="relative max-w-xl lg:max-w-md">
                <Search className="w-4 h-4 text-[#d4af37]/60 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  placeholder="Search products, SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="cf-input w-full pl-9 pr-4 py-3 text-sm"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1 lg:flex-wrap lg:overflow-visible">
                {categoryTabs.map((cat, idx) => (
                  <button
                    key={`${cat}-${idx}`}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      selectedCategory === cat
                        ? 'bg-gradient-to-r from-[#b65200] to-[#d66b0f] text-white shadow-sm'
                        : 'bg-[#222222] border border-white/10 text-cf-muted hover:border-[#d4af37]/40 hover:text-[#d4af37]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 lg:gap-4 pb-2">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-cf-muted text-sm">
                    <Package2 className="w-10 h-10 mx-auto mb-2 text-[#d4af37]/40" />
                    No products found
                  </div>
                ) : (
                  filteredProducts.map((p) => (
                    <React.Fragment key={p.id}>{renderProductCard(p)}</React.Fragment>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4 pb-2">
              <div className="flex items-center justify-between lg:hidden">
                <h2 className="text-lg font-semibold text-white">My Orders</h2>
                <button
                  type="button"
                  onClick={fetchData}
                  disabled={loading}
                  className="p-2 rounded-lg border border-[#d4af37]/30 bg-[#222222] hover:border-[#d4af37] transition"
                >
                  <RefreshCw className={`w-4 h-4 text-[#d4af37] ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {myRequirements.length === 0 ? (
                <div className="cf-product-card p-8 text-center text-cf-muted text-sm">
                  <ClipboardList className="w-10 h-10 mx-auto mb-2 text-[#d4af37]/40" />
                  No orders yet. Browse the catalog to place one.
                </div>
              ) : (
                <>
                  <div className="hidden lg:block overflow-x-auto cf-admin-card rounded-xl">
                    <table className="cf-admin-table min-w-full">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Quantity</th>
                          <th>Value</th>
                          <th>Date</th>
                          <th>Order Pipeline</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myRequirements.map((req) => (
                          <tr key={req.id}>
                            <td className="py-4 px-5">
                              <span className="cf-td-title">{req.productName}</span>
                              <span className="cf-td-meta font-mono block">{req.id}</span>
                              {req.notes && <span className="cf-td-meta italic block mt-1">"{req.notes}"</span>}
                            </td>
                            <td className="py-4 px-5 cf-td-value font-semibold">{req.quantityRequested} units</td>
                            <td className="py-4 px-5 cf-td-mono">{formatINR(req.orderValue || 0)}</td>
                            <td className="py-4 px-5 cf-td-date">
                              {new Date(req.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-4 px-5 min-w-[220px]">
                              <OrderProgress status={req.status} />
                            </td>
                            <td className="py-4 px-5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadgeClass(req.status)}`}>
                                {orderStatusLabel(req.status)}
                              </span>
                            </td>
                            <td className="py-4 px-5 text-right">
                              {canDealerCancel(req.status) ? (
                                <button
                                  type="button"
                                  onClick={() => handleCancelRequirement(req.id)}
                                  className="py-1.5 px-3 text-xs font-semibold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition"
                                >
                                  Cancel
                                </button>
                              ) : (
                                <span className="text-cf-muted text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="lg:hidden space-y-3">
                    {myRequirements.map(renderOrderCard)}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'wallet' && (
            <div className="space-y-4 pb-2 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
              <div className="lg:col-span-1 space-y-4">
                <div className="cf-product-card p-4 border border-[#d4af37]/20">
                  <div className="flex items-center justify-between mb-3 lg:hidden">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#d4af37]" />
                      Wallet / Ledger
                    </h2>
                    <button type="button" onClick={fetchData} disabled={loading} className="p-2 rounded-lg border border-white/10 text-[#d4af37]">
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <h2 className="hidden lg:flex text-sm font-semibold text-white items-center gap-2 mb-4">
                    <Landmark className="w-4 h-4 text-[#d4af37]" />
                    Credit Summary
                  </h2>
                  {creditSummaryCards}
                  <p className="text-[10px] text-cf-muted mt-3">Payment terms: <span className="text-cf-secondary">{credit.creditDays} days</span></p>
                </div>
              </div>
              <div className="lg:col-span-2 cf-product-card p-4 lg:p-5 border border-[#d4af37]/20">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4 text-[#d4af37]" />
                  Transaction Ledger
                </h2>
                <DealerLedger entries={ledgerEntries} loading={loading} />
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-4 pb-2 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:items-start">
              <div className="cf-product-card p-5 space-y-4 border border-[#d4af37]/20">
                <div className="flex items-center gap-2 text-[#d4af37]">
                  <Landmark className="w-4 h-4" />
                  <h3 className="text-sm font-semibold text-white">Credit Account</h3>
                </div>
                {creditSummaryCards}
                <p className="text-[10px] text-cf-muted">Payment terms: <span className="text-cf-secondary">{credit.creditDays} days</span></p>
              </div>

              <div className="space-y-4">
                <div className="cf-product-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-[#b65200]/20 text-[#d4af37] text-[10px] font-bold rounded-full uppercase border border-[#d4af37]/30">
                      {profile.status}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">{profile.companyName}</h2>
                    <p className="text-sm text-cf-secondary mt-1">{profile.ownerName}</p>
                  </div>
                  <div className="space-y-2 text-sm border-t border-white/10 pt-4">
                    <div className="flex justify-between gap-4">
                      <span className="text-cf-muted">Email</span>
                      <span className="font-medium text-white text-right truncate">{profile.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cf-muted">Mobile</span>
                      <span className="font-medium text-white">+91 {profile.mobile}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-cf-muted">GST</span>
                      <span className="font-mono font-semibold text-[#d4af37]">{profile.gstNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cf-muted">Location</span>
                      <span className="font-medium text-white">{profile.city}, {profile.state}</span>
                    </div>
                  </div>
                  <p className="text-xs text-cf-secondary leading-relaxed">{profile.address}</p>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full cf-btn-outline py-3 rounded-xl text-sm flex items-center justify-center gap-2 lg:hidden"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="cf-dealer-bottom-nav lg:hidden fixed bottom-0 inset-x-0 z-30 px-2 pt-2">
        <div className="max-w-lg mx-auto grid grid-cols-4 gap-1">
          {navItems.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition relative ${
                activeTab === id ? 'cf-dealer-tab-active' : 'text-cf-muted hover:text-cf-secondary'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{label}</span>
              {badge ? (
                <span className="absolute top-0.5 right-1/4 min-w-[16px] h-4 px-1 bg-[#b65200] text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-1 ring-[#d4af37]/50">
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/70 backdrop-blur-sm p-0 lg:p-4"
          onClick={() => !submitting && setSelectedProduct(null)}
        >
          <div
            className="cf-dealer-sheet rounded-t-2xl lg:rounded-2xl max-h-[90vh] lg:max-h-[85vh] w-full lg:max-w-lg overflow-y-auto animate-slide-up lg:animate-fade-in shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#1a1a1a] border-b border-white/10 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#d4af37]" />
                Stock Indent
              </h3>
              <button type="button" onClick={() => setSelectedProduct(null)} className="p-1 text-cf-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
                <p className="font-semibold text-white">Order Placed</p>
                <p className="text-sm text-cf-secondary">Your indent was submitted. Track progress under Orders.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitRequirement} className="p-4 space-y-4 pb-8">
                <div className="flex gap-3">
                  <img src={selectedProduct.image} alt="" className="w-16 h-16 rounded-lg object-cover bg-[#171717] ring-1 ring-white/10" referrerPolicy="no-referrer" />
                  <div>
                    <p className="font-semibold text-white text-sm">{selectedProduct.name}</p>
                    <p className="text-xs text-cf-muted font-mono">{selectedProduct.sku}</p>
                    <p className="text-sm font-bold text-[#d4af37] mt-1">
                      ₹{(selectedProduct.wholesalePrice || selectedProduct.price).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-[#171717] rounded-lg p-3 border border-white/10">
                  <div><span className="text-cf-muted block">Material</span><span className="text-white">{selectedProduct.material}</span></div>
                  <div><span className="text-cf-muted block">Stock</span><span className="text-white">{selectedProduct.availableStock} units</span></div>
                  <div className="col-span-2"><span className="text-cf-muted block">Dimensions</span><span className="text-white">{selectedProduct.dimensions}</span></div>
                </div>

                {(selectedProduct.designSheetUrl || selectedProduct.brochureUrl) && (
                  <div className="flex gap-2">
                    {selectedProduct.designSheetUrl && (
                      <a href={selectedProduct.designSheetUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 py-2 cf-btn-outline rounded-lg text-xs">
                        <FileText className="w-3.5 h-3.5" /> Sheet
                      </a>
                    )}
                    {selectedProduct.brochureUrl && (
                      <a href={selectedProduct.brochureUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 py-2 cf-btn-outline rounded-lg text-xs">
                        <Download className="w-3.5 h-3.5" /> Brochure
                      </a>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-[#d4af37] block mb-1">Quantity (units) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={selectedProduct.availableStock}
                    value={requestQty}
                    onChange={(e) =>
                      setRequestQty(Math.min(selectedProduct.availableStock, Math.max(1, parseInt(e.target.value) || 1)))
                    }
                    className="cf-input w-full px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#d4af37] block mb-1">Notes (optional)</label>
                  <textarea
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    rows={2}
                    placeholder="Delivery preferences, finish, etc."
                    className="cf-input w-full px-3 py-2.5 text-sm resize-none"
                  />
                </div>

                <div className="text-xs bg-[#171717] rounded-lg p-3 border border-white/10 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-cf-muted">Order Value</span>
                    <span className="text-white font-bold">{formatINR(selectedOrderValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cf-muted">Available Credit</span>
                    <span className={exceedsCredit ? 'text-red-400 font-bold' : 'text-[#d4af37] font-bold'}>
                      {formatINR(credit.availableCredit)}
                    </span>
                  </div>
                  {exceedsCredit && (
                    <p className="text-red-400 font-semibold pt-1 border-t border-white/10">Order cannot be placed</p>
                  )}
                </div>

                <button type="submit" disabled={submitting || exceedsCredit} className="w-full cf-btn-brand py-3.5 rounded-xl text-sm disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Stock Indent'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#222222] border border-white/10 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-white">{confirmModal.title}</h4>
                <p className="text-sm text-cf-secondary mt-1">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmModal(null)} className="flex-1 cf-btn-outline py-2.5 rounded-xl text-sm">
                Keep
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await confirmModal.onConfirm();
                  } finally {
                    setConfirmModal(null);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition"
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

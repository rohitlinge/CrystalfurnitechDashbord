import React, { useState, useEffect } from 'react';
import { DBService } from '../firebase';
import { DealerProfile, ProductItem, StockRequirement, CategoryItem } from '../types';
import BrandLogo from './BrandLogo';
import {
  Search, LogOut, Package2, ClipboardList, User, ShoppingCart, RefreshCw,
  CheckCircle, X, FileText, Download, AlertTriangle
} from 'lucide-react';

interface DealerDashboardProps {
  dealerUser: DealerProfile;
  onLogout: () => void;
}

type MobileTab = 'catalog' | 'orders' | 'account';

export default function DealerDashboard({ dealerUser, onLogout }: DealerDashboardProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [myRequirements, setMyRequirements] = useState<StockRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [mobileTab, setMobileTab] = useState<MobileTab>('catalog');

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
      const [catList, prodList, reqList] = await Promise.all([
        DBService.getCategories(),
        DBService.getProducts(),
        DBService.getStockRequirements(dealerUser.uid),
      ]);
      setCategories(catList);
      setProducts(prodList);
      setMyRequirements(reqList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dealerUser.uid]);

  const handleSubmitRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (requestQty < 1) {
      alert('Please request at least 1 unit.');
      return;
    }
    if (requestQty > selectedProduct.availableStock) {
      alert(`Only ${selectedProduct.availableStock} units available.`);
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
        setMobileTab('orders');
        fetchData();
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit indent.';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequirement = (reqId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancel Stock Indent',
      message: 'Cancel this pending request? Reserved stock will be released back to the catalog.',
      actionLabel: 'Yes, Cancel',
      onConfirm: async () => {
        await DBService.updateStockRequirementStatus(reqId, 'Cancelled');
        await fetchData();
      },
    });
  };

  const activeCategoryNames = categories.filter((c) => c.isActive !== false).map((c) => c.name);
  const activeProducts = products.filter((p) => p.isActive !== false);
  const categoryFilterOptions =
    activeCategoryNames.length > 0 ? activeCategoryNames : [...new Set(activeProducts.map((p) => p.category))];
  const categoryTabs = ['All', ...categoryFilterOptions];

  const filteredProducts = activeProducts.filter((p) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.material.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const pendingCount = myRequirements.filter((r) => r.status === 'Pending').length;

  return (
    <div className="cf-dealer min-h-screen flex flex-col">
      {/* Mobile header */}
      <header className="cf-dealer-header sticky top-0 z-20 px-4 py-3 flex items-center justify-between shadow-md">
        <BrandLogo variant="light" size="sm" subtitle="Dealer Portal" />
        <button
          type="button"
          onClick={onLogout}
          className="p-2 rounded-lg border border-white/20 text-white hover:bg-white/10 transition"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 px-4 pt-4 space-y-4 max-w-lg mx-auto w-full">
        {mobileTab === 'catalog' && (
          <>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Search products, SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="cf-input w-full pl-9 pr-4 py-3 text-sm"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
              {categoryTabs.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                    selectedCategory === cat
                      ? 'bg-[#b65200] text-white'
                      : 'bg-white border border-neutral-200 text-neutral-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-3 pb-2">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 text-sm">
                  <Package2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  No products found
                </div>
              ) : (
                filteredProducts.map((p) => (
                  <article key={p.id} className="cf-product-card">
                    <div className="flex gap-3 p-3">
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <p className="text-[10px] font-semibold text-[#b65200] uppercase tracking-wide">{p.category}</p>
                          <h3 className="text-sm font-semibold text-black leading-snug line-clamp-2">{p.name}</h3>
                          <p className="text-xs text-neutral-500 font-mono mt-0.5">{p.sku}</p>
                        </div>
                        <div className="flex items-end justify-between mt-2">
                          <div>
                            <p className="text-base font-bold text-black">₹{p.price.toLocaleString('en-IN')}</p>
                            <p className={`text-[10px] font-semibold ${
                              p.availableStock === 0 ? 'text-red-600' : p.availableStock <= 5 ? 'text-[#b65200]' : 'text-green-700'
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
                            className="cf-btn-brand px-3 py-2 rounded-lg text-xs flex items-center gap-1 disabled:opacity-40"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            Indent
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        )}

        {mobileTab === 'orders' && (
          <div className="space-y-3 pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-black">My Stock Indents</h2>
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="p-2 rounded-lg border border-neutral-200 bg-white"
              >
                <RefreshCw className={`w-4 h-4 text-[#b65200] ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {myRequirements.length === 0 ? (
              <div className="cf-product-card p-8 text-center text-neutral-500 text-sm">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-40" />
                No indents yet. Browse the catalog to submit one.
              </div>
            ) : (
              myRequirements.map((req) => (
                <div key={req.id} className="cf-product-card p-4 space-y-3">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-black truncate">{req.productName}</h3>
                      <p className="text-[10px] text-neutral-400 font-mono">{req.id}</p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        req.status === 'Fulfilled'
                          ? 'bg-green-100 text-green-800'
                          : req.status === 'Cancelled'
                          ? 'bg-neutral-100 text-neutral-500'
                          : 'bg-[#fef3e8] text-[#b65200]'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-neutral-400">Quantity</p>
                      <p className="font-bold text-black">{req.quantityRequested} units</p>
                    </div>
                    <div>
                      <p className="text-neutral-400">Date</p>
                      <p className="font-medium text-black">
                        {new Date(req.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  {req.notes && <p className="text-xs text-neutral-500 italic border-t border-neutral-100 pt-2">"{req.notes}"</p>}
                  {req.status === 'Pending' && (
                    <button
                      type="button"
                      onClick={() => handleCancelRequirement(req.id)}
                      className="w-full py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-lg"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {mobileTab === 'account' && (
          <div className="space-y-4 pb-2">
            <div className="cf-product-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-[#fef3e8] text-[#b65200] text-[10px] font-bold rounded-full uppercase">
                  {dealerUser.status}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-black">{dealerUser.companyName}</h2>
                <p className="text-sm text-neutral-500 mt-1">{dealerUser.ownerName}</p>
              </div>
              <div className="space-y-2 text-sm border-t border-neutral-100 pt-4">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Email</span>
                  <span className="font-medium text-black text-right truncate ml-4">{dealerUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Mobile</span>
                  <span className="font-medium text-black">+91 {dealerUser.mobile}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">GST</span>
                  <span className="font-mono font-medium text-black">{dealerUser.gstNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Location</span>
                  <span className="font-medium text-black">{dealerUser.city}, {dealerUser.state}</span>
                </div>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">{dealerUser.address}</p>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="w-full cf-btn-outline py-3 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="cf-dealer-bottom-nav fixed bottom-0 inset-x-0 z-30 px-2 pt-2">
        <div className="max-w-lg mx-auto grid grid-cols-3 gap-1">
          {([
            { id: 'catalog' as const, label: 'Catalog', icon: Package2 },
            { id: 'orders' as const, label: 'Indents', icon: ClipboardList, badge: pendingCount },
            { id: 'account' as const, label: 'Account', icon: User },
          ]).map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id)}
              className={`flex flex-col items-center gap-0.5 py-2 rounded-xl transition relative ${
                mobileTab === id ? 'cf-dealer-tab-active bg-[#fef3e8]' : 'text-neutral-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{label}</span>
              {badge ? (
                <span className="absolute top-1 right-1/4 min-w-[16px] h-4 px-1 bg-[#b65200] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      {/* Bottom sheet — stock indent */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={() => !submitting && setSelectedProduct(null)}>
          <div
            className="bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-neutral-100 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-black">Stock Indent</h3>
              <button type="button" onClick={() => setSelectedProduct(null)} className="p-1 text-neutral-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                <p className="font-semibold text-black">Indent Submitted</p>
                <p className="text-sm text-neutral-500">Your request was sent to Crystal Furnitech.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitRequirement} className="p-4 space-y-4 pb-8">
                <div className="flex gap-3">
                  <img src={selectedProduct.image} alt="" className="w-16 h-16 rounded-lg object-cover bg-neutral-100" referrerPolicy="no-referrer" />
                  <div>
                    <p className="font-semibold text-black text-sm">{selectedProduct.name}</p>
                    <p className="text-xs text-neutral-500 font-mono">{selectedProduct.sku}</p>
                    <p className="text-sm font-bold text-[#b65200] mt-1">
                      ₹{(selectedProduct.wholesalePrice || selectedProduct.price).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-50 rounded-lg p-3">
                  <div><span className="text-neutral-400 block">Material</span>{selectedProduct.material}</div>
                  <div><span className="text-neutral-400 block">Stock</span>{selectedProduct.availableStock} units</div>
                  <div className="col-span-2"><span className="text-neutral-400 block">Dimensions</span>{selectedProduct.dimensions}</div>
                </div>

                {(selectedProduct.designSheetUrl || selectedProduct.brochureUrl) && (
                  <div className="flex gap-2">
                    {selectedProduct.designSheetUrl && (
                      <a href={selectedProduct.designSheetUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 py-2 border border-neutral-200 rounded-lg text-xs font-semibold">
                        <FileText className="w-3.5 h-3.5" /> Sheet
                      </a>
                    )}
                    {selectedProduct.brochureUrl && (
                      <a href={selectedProduct.brochureUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 py-2 border border-neutral-200 rounded-lg text-xs font-semibold">
                        <Download className="w-3.5 h-3.5" /> Brochure
                      </a>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-neutral-600 block mb-1">Quantity (units) *</label>
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
                  <label className="text-xs font-semibold text-neutral-600 block mb-1">Notes (optional)</label>
                  <textarea
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    rows={2}
                    placeholder="Delivery preferences, finish, etc."
                    className="cf-input w-full px-3 py-2.5 text-sm resize-none"
                  />
                </div>

                <button type="submit" disabled={submitting} className="w-full cf-btn-brand py-3.5 rounded-xl text-sm">
                  {submitting ? 'Submitting...' : 'Submit Stock Indent'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-black">{confirmModal.title}</h4>
                <p className="text-sm text-neutral-500 mt-1">{confirmModal.message}</p>
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
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white"
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

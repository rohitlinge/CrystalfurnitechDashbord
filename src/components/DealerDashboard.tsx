import React, { useState, useEffect } from 'react';
import { DBService } from '../firebase';
import { DealerProfile, ProductItem, StockRequirement } from '../types';
import { 
  Building, MapPin, Truck, RefreshCw, Send, ClipboardCheck, LayoutGrid, Search, 
  Info, LogOut, Package2, ShieldCheck, ShoppingCart, Calendar, CheckCircle, Clock, X, SlidersHorizontal,
  FileText, Download
} from 'lucide-react';

interface DealerDashboardProps {
  dealerUser: DealerProfile;
  onLogout: () => void;
}

export default function DealerDashboard({ dealerUser, onLogout }: DealerDashboardProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [myRequirements, setMyRequirements] = useState<StockRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Create / Submit stock indent modal state
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [requestQty, setRequestQty] = useState(5);
  const [requestNotes, setRequestNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const prodList = await DBService.getProducts();
      setProducts(prodList);

      const reqList = await DBService.getStockRequirements(dealerUser.uid);
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
      alert("Please request a positive wholesale quantity (minimum 1 unit).");
      return;
    }

    if (requestQty > selectedProduct.availableStock) {
      alert(`Cannot request ${requestQty} items. Only ${selectedProduct.availableStock} items are currently available in stock.`);
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
        notes: requestNotes
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setSelectedProduct(null);
        setRequestQty(5);
        setRequestNotes('');
        fetchData(); // reload
      }, 2000);

    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "Failed submitting wholesale requirement. Please retry.";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequirement = async (reqId: string) => {
    if (window.confirm("Are you sure you want to cancel this pending stock request?")) {
      try {
        await DBService.updateStockRequirementStatus(reqId, 'Cancelled');
        await fetchData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Get distinct categories (only from active products)
  const activeProducts = products.filter(p => p.isActive !== false);
  const categories = ['All', ...new Set(activeProducts.map(p => p.category))];

  // Filtering products
  const filteredProducts = activeProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.material.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col text-[#fafafa]">
      
      {/* HEADER SECTION */}
      <header className="bg-[#18181b] border-b border-[#27272a] text-[#fafafa] sticky top-0 z-10 shrink-0 animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          
          <div className="flex items-center gap-2.5">
            <div className="bg-[#27272a]/40 p-2 rounded-lg border border-[#27272a]">
              <Building className="w-5.5 h-5.5 text-zinc-300" />
            </div>
            <div>
              <h1 className="font-serif italic text-base sm:text-lg font-medium tracking-tight text-[#fafafa]">Crystal Furnitech</h1>
              <p className="text-[10px] text-[#a1a1aa] font-semibold tracking-wider uppercase">Approved Wholesale Partner Area</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <span className="text-[10px] text-[#a1a1aa] block font-semibold uppercase">Authorized Dealer</span>
              <span className="text-xs font-semibold text-[#fafafa]">{dealerUser.companyName}</span>
            </div>
            <button 
              id="dealer-logout-btn"
              onClick={onLogout}
              className="py-1.5 px-3 bg-transparent hover:bg-[#fafafa] hover:text-[#09090b] text-[#fafafa] text-xs font-medium rounded-lg transition border border-[#27272a] cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* BODY CONTENT */}
      <main className="grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Dealer Corporate Info Header Area */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 rounded-full text-[10px] font-bold font-mono tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                {dealerUser.status.toUpperCase()}
              </span>
              <span className="text-xs text-[#a1a1aa] font-medium">Dealer UID: {dealerUser.uid.substring(0, 10)}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#fafafa] tracking-tight">{dealerUser.companyName}</h2>
            <p className="text-xs text-[#a1a1aa] leading-relaxed max-w-lg">
              Authorized to view exclusive B2B wholesale furniture quotes, track direct indent sourcing, and submit volume stock replenishments.
            </p>
          </div>

          {/* Contact Details metrics */}
          <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-[#27272a] pt-4 md:pt-0 md:pl-6 text-xs text-[#a1a1aa]">
            <span className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider block mb-1">Company Contact</span>
            <p className="font-semibold text-[#fafafa]">Owner: {dealerUser.ownerName}</p>
            <p>Email: {dealerUser.email}</p>
            <p>Tel: +91 {dealerUser.mobile}</p>
          </div>

          {/* Registration and GST profile metrics */}
          <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-[#27272a] pt-4 md:pt-0 md:pl-6 text-xs text-[#a1a1aa]">
            <span className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider block mb-1">Corporate Registration</span>
            <p className="font-semibold text-zinc-300 uppercase font-mono">GST: {dealerUser.gstNumber}</p>
            <p className="truncate">HQ: {dealerUser.address}</p>
            <p>City/State: {dealerUser.city}, {dealerUser.state}</p>
          </div>

        </div>

        {/* Catalog and Requirement tracking panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* CATALOG SECTION (2 Cols width) */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[#fafafa] tracking-tight flex items-center gap-2">
                  <Package2 className="w-5 h-5 text-zinc-400" />
                  Premium Wholesale Catalog
                </h3>
                <p className="text-xs text-[#a1a1aa] font-medium mt-0.5">Direct distributor rate-cards for original Crystal Furnitech collections.</p>
              </div>

              {/* Filters list */}
              <div className="flex flex-wrap gap-1.5 bg-[#09090b] border border-[#27272a] p-1 rounded-lg scrollbar-none overflow-x-auto max-w-full">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`py-1.5 px-3 rounded-md text-[11px] font-semibold tracking-wide transition cursor-pointer shrink-0 ${
                      selectedCategory === cat 
                        ? 'bg-[#18181b] border border-[#27272a] text-[#fafafa] shadow-md' 
                        : 'text-[#a1a1aa] hover:text-[#fafafa]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog search/filters block */}
            <div className="relative">
              <Search className="w-4.5 h-4.5 text-zinc-500 absolute left-3.5 top-3.5" />
              <input 
                id="catalog-search"
                type="text"
                placeholder="Search collection items, SKU codes, wood types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-xs bg-[#18181b] border border-[#27272a] text-[#fafafa] placeholder-zinc-500 rounded-lg focus:border-[#fafafa] outline-none transition"
              />
            </div>

            {/* Catalog Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {filteredProducts.length === 0 ? (
                <div className="sm:col-span-2 py-16 text-center text-[#a1a1aa] text-xs font-semibold">
                  <Package2 className="w-12 h-12 text-[#27272a] mx-auto mb-3" />
                  No collections matching search parameters.
                </div>
              ) : (
                filteredProducts.map((p) => (
                  <div key={p.id} className="bg-[#18181b] hover:bg-[#18181b]/80 border border-[#27272a] rounded-xl overflow-hidden shadow-none transition duration-300 flex flex-col justify-between hover:border-zinc-550 group">
                    
                    <div>
                      {/* Image Frame */}
                      <div className="aspect-video relative overflow-hidden bg-zinc-950/40">
                        <img 
                          src={p.image} 
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <span className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-sm ${
                          p.stockStatus === 'In Stock' 
                            ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' 
                            : p.stockStatus === 'Low Stock' 
                            ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20' 
                            : 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20'
                        }`}>
                          {p.stockStatus}
                        </span>
                        
                        <span className="absolute bottom-3 left-3 bg-[#09090b]/85 border border-[#27272a] text-[10px] text-[#fafafa] px-2 py-0.5 rounded font-semibold">
                          {p.category}
                        </span>
                      </div>

                      {/* Info body */}
                      <div className="p-5 space-y-2">
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="text-sm font-semibold text-[#fafafa] leading-snug group-hover:text-white transition">{p.name}</h4>
                          <span className="text-zinc-300 font-bold font-mono text-sm whitespace-nowrap">₹{(p.price).toLocaleString('en-IN')}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1">
                          <span>SKU: {p.sku}</span>
                          <span className="text-zinc-400 font-sans font-semibold">{p.material}</span>
                        </div>

                        <p className="text-xs text-[#a1a1aa] leading-relaxed line-clamp-2">
                          {p.description}
                        </p>

                        <div className="text-[10px] text-zinc-550 py-1.5 border-t border-dashed border-[#27272a] flex items-center justify-between">
                          <span>Dimensions: <strong className="text-zinc-400">{p.dimensions}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Submit Indent Actions bar */}
                    <div className="px-5 pb-5 pt-1.5 shrink-0">
                      <button
                        id={`btn-order-${p.id}`}
                        type="button"
                        disabled={p.availableStock === 0}
                        onClick={() => {
                          setSelectedProduct(p);
                          setRequestQty(Math.min(5, p.availableStock));
                          setRequestNotes('');
                          setSubmitSuccess(false);
                        }}
                        className={`w-full py-2 font-bold text-xs rounded-lg transition tracking-wide flex items-center justify-center gap-1.5 cursor-pointer ${
                          p.availableStock === 0 
                            ? 'bg-[#18181b]/60 text-zinc-500 border border-[#27272a] cursor-not-allowed' 
                            : 'bg-[#fafafa] text-[#09090b] hover:bg-[#a1a1aa]'
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {p.availableStock === 0 ? "Out of Stock" : "Submit Stock Indent"}
                      </button>
                    </div>

                  </div>
                ))
              )}
            </div>

          </div>

          {/* MY HISTORIC REQUIREMENTS (1 Col width) */}
          <div className="space-y-6">
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#fafafa] tracking-tight flex items-center gap-1.5">
                  <ClipboardCheck className="w-5 h-5 text-zinc-400" />
                  Your Active Indents
                </h3>
                <p className="text-xs text-[#a1a1aa] mt-0.5">Submitted replenishment requests</p>
              </div>

              <button 
                id="btn-refresh-indents"
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="p-1.5 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-md hover:bg-[#fafafa] hover:text-[#09090b] cursor-pointer transition duration-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* List and Status badges of requirements */}
            <div className="space-y-4">
              {myRequirements.length === 0 ? (
                <div className="bg-[#18181b] rounded-xl border border-[#27272a] p-8 text-center text-[#a1a1aa] text-xs">
                  <Calendar className="w-8 h-8 text-[#27272a] mx-auto mb-2" />
                  No stock requirements filed. Click "Submit Stock Indent" on any catalog product.
                </div>
              ) : (
                myRequirements.map((req) => {
                  return (
                    <div key={req.id} className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 space-y-3 hover:translate-y-[-1px] transition duration-200">
                      
                      <div className="flex items-start justify-between gap-2 border-b border-[#27272a] pb-2">
                        <div>
                          <h4 className="text-xs font-semibold text-[#fafafa]">{req.productName}</h4>
                          <span className="text-[9px] text-[#a1a1aa] block font-mono mt-0.5">Indent Ref ID: {req.id}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.status === 'Fulfilled' 
                            ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20' 
                            : req.status === 'Cancelled' 
                            ? 'bg-zinc-800 text-[#a1a1aa]' 
                            : 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 font-semibold animate-pulse'
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-[#a1a1aa] font-medium">
                        
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Requested Indent</span>
                          <span className="text-sm font-bold text-[#fafafa]">{req.quantityRequested} Units</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-zinc-500 block">Date Lodged</span>
                          <span className="text-zinc-300">{new Date(req.requestedDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short'
                          })}</span>
                        </div>

                      </div>

                      {req.notes && (
                        <p className="text-[10px] bg-[#09090b] border border-[#27272a] p-2 rounded text-[#a1a1aa] leading-normal italic">
                          "{req.notes}"
                        </p>
                      )}

                      {/* Cancel pending active indent */}
                      {req.status === 'Pending' && (
                        <button
                          id={`btn-cancel-req-${req.id}`}
                          type="button"
                          onClick={() => handleCancelRequirement(req.id)}
                          className="w-full py-1.5 bg-transparent hover:bg-[#ef4444]/20 hover:text-[#ef4444] text-[#ef4444] border border-[#ef4444]/20 text-[10px] font-bold rounded-lg cursor-pointer transition duration-200"
                        >
                          Cancel Request
                        </button>
                      )}

                    </div>
                  )
                })
              )}
            </div>

          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer className="shrink-0 bg-[#09090b] border-t border-[#27272a] py-6 mt-16">
        <div className="text-center text-xs text-[#a1a1aa]">
          📍 Authorized dealer access portal of Crystal Furnitech. All trade actions subject to master distributor supply contracts.
        </div>
      </footer>

      {/* REPLENISHMENT MODAL (ZERO DEPENDENCY MODAL) */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#18181b] rounded-xl border border-[#27272a] max-w-sm w-full p-6 space-y-4 shadow-2xl">
            
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#fafafa] flex items-center gap-1.5">
                <Truck className="w-5 h-5 text-zinc-400" />
                Submit Sourcing Requirement
              </h4>
              <button 
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="text-[#a1a1aa] hover:text-[#fafafa] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="text-center py-6 space-y-2">
                <div className="w-12 h-12 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 animate-bounce" />
                </div>
                <h5 className="font-semibold text-[#fafafa] text-sm">Stock Indent Lodged</h5>
                <p className="text-xs text-[#a1a1aa]">Your wholesale replenishment request was filed successfully with the backoffice.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitRequirement} className="space-y-4">
                
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Target Product</span>
                    <span className="font-semibold text-sm text-[#fafafa] block leading-tight">{selectedProduct.name}</span>
                    <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">SKU: {selectedProduct.sku}</span>
                  </div>

                  {/* Rich Specifications & Specs Grid Component */}
                  <div className="bg-[#09090b] border border-[#27272a] p-3 rounded-lg space-y-2.5">
                    {/* Gallery Thumbnails */}
                    {selectedProduct.images && selectedProduct.images.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
                        {selectedProduct.images.map((img, idx) => (
                          <div key={idx} className="relative w-10 h-10 rounded border border-[#27272a] overflow-hidden flex-shrink-0 bg-zinc-900">
                            <img src={img} alt="Product spec" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] text-zinc-400 border-t border-[#27272a]/60 pt-2.5">
                      <div>
                        <span className="text-zinc-500 block uppercase font-bold tracking-wider text-[8px]">Material</span>
                        <span className="font-medium text-[#fafafa]">{selectedProduct.material}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block uppercase font-bold tracking-wider text-[8px]">Color Spec</span>
                        <span className="font-medium text-[#fafafa]">{selectedProduct.color || 'Standard'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block uppercase font-bold tracking-wider text-[8px]">Dimensions</span>
                        <span className="font-medium text-[#fafafa]">{selectedProduct.dimensions}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block uppercase font-bold tracking-wider text-[8px]">Wholesale Price</span>
                        <span className="font-semibold text-[#fafafa]">₹{(selectedProduct.wholesalePrice || selectedProduct.price).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block uppercase font-bold tracking-wider text-[8px]">Available Stock</span>
                        <span className={`font-semibold ${selectedProduct.availableStock <= 5 ? 'text-[#f59e0b]' : 'text-[#10b981]'}`}>{selectedProduct.availableStock} Units</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block uppercase font-bold tracking-wider text-[8px]">Wholesale MOQ</span>
                        <span className="font-semibold text-[#fafafa]">{selectedProduct.minimumOrderQuantity || 1} Units</span>
                      </div>
                    </div>

                    {/* Media Attachments Section */}
                    {(selectedProduct.designSheetUrl || selectedProduct.brochureUrl) && (
                      <div className="border-t border-[#27272a]/60 pt-2.5 space-y-2">
                        <span className="text-zinc-500 uppercase font-bold tracking-wider text-[8px] block">Media & Document Downloads</span>
                        <div className="flex gap-2">
                          {selectedProduct.designSheetUrl && (
                            <a 
                              href={selectedProduct.designSheetUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="grow flex items-center justify-between p-2 bg-[#18181b] hover:bg-zinc-850 border border-[#27272a] rounded-lg text-[10px] text-[#fafafa] transition"
                            >
                              <span className="flex items-center gap-1.5 font-semibold">
                                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                                Design Sheet
                              </span>
                              <Download className="w-3.5 h-3.5 text-[#fafafa] flex-shrink-0" />
                            </a>
                          )}
                          {selectedProduct.brochureUrl && (
                            <a 
                              href={selectedProduct.brochureUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="grow flex items-center justify-between p-2 bg-[#18181b] hover:bg-zinc-850 border border-[#27272a] rounded-lg text-[10px] text-[#fafafa] transition"
                            >
                              <span className="flex items-center gap-1.5 font-semibold">
                                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                                Product Brochure
                              </span>
                              <Download className="w-3.5 h-3.5 text-[#fafafa] flex-shrink-0" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Units Indent */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#a1a1aa] block">Requested Indent Volume (Units) *</label>
                  <input 
                    type="number"
                    required
                    min={1}
                    max={selectedProduct.availableStock}
                    value={requestQty}
                    onChange={(e) => setRequestQty(Math.min(selectedProduct.availableStock, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-full text-xs p-2.5 bg-[#09090b] border border-[#27272a] text-[#fafafa] rounded-lg focus:border-[#fafafa] outline-none transition"
                  />
                  <span className="text-[9px] text-[#f59e0b] block font-medium">
                    Maximum units allowed for this request: {selectedProduct.availableStock} items
                  </span>
                </div>

                {/* Additional notes/preferences */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#a1a1aa] block">Logistics, Dispatches & Custom Finish notes</label>
                  <textarea
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    placeholder="e.g. Needs immediate dispatch before Monday; prefer natural teak finish varnish coating if applicable..."
                    rows={3}
                    className="w-full text-xs p-2.5 bg-[#09090b] border border-[#27272a] text-[#fafafa] placeholder-[#a1a1aa] focus:border-[#fafafa] rounded-lg outline-none resize-none transition"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="flex-1 py-2 bg-transparent hover:bg-[#27272a] rounded-lg border border-[#27272a] text-xs text-[#fafafa] font-semibold transition"
                  >
                    Go Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2 bg-[#fafafa] hover:bg-[#a1a1aa] text-[#09090b] rounded-lg text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-1"
                  >
                    {submitting ? "Lodging..." : "Submit Indent"}
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

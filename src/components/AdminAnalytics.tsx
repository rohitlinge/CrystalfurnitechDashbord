import React, { useMemo } from 'react';
import { DealerProfile, ProductItem, StockRequirement } from '../types';
import {
  TrendingUp, Package, Users, AlertTriangle, MapPin, BarChart3,
  ShoppingBag, Clock, IndianRupee
} from 'lucide-react';
import { normalizeOrderStatus, isActiveOrder, orderStatusLabel } from '../orders';

interface AdminAnalyticsProps {
  dealers: DealerProfile[];
  products: ProductItem[];
  requirements: StockRequirement[];
}

function fmt(n: number) {
  return n.toLocaleString('en-IN');
}

function fmtCurrency(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${fmt(n)}`;
}

export default function AdminAnalytics({ dealers, products, requirements }: AdminAnalyticsProps) {
  const analytics = useMemo(() => {
    const activeProducts = products.filter((p) => p.isActive !== false);
    const totalStockUnits = activeProducts.reduce((s, p) => s + (p.availableStock || 0), 0);
    const inventoryValue = activeProducts.reduce(
      (s, p) => s + (p.wholesalePrice || p.price || 0) * (p.availableStock || 0),
      0
    );
    const lowStock = activeProducts.filter((p) => p.availableStock > 0 && p.availableStock <= 5);
    const outOfStock = activeProducts.filter((p) => p.availableStock === 0);
    const pendingDealers = dealers.filter((d) => d.status === 'Pending Approval');
    const approvedDealers = dealers.filter((d) => d.status === 'Approved');

    const pendingReqs = requirements.filter((r) => normalizeOrderStatus(r.status) === 'Pending');
    const deliveredReqs = requirements.filter((r) => normalizeOrderStatus(r.status) === 'Delivered');
    const activeReqs = requirements.filter((r) => isActiveOrder(r.status));
    const inProductionReqs = requirements.filter((r) => {
      const s = normalizeOrderStatus(r.status);
      return s === 'Production' || s === 'Packed' || s === 'Dispatched';
    });
    const totalUnitsRequested = requirements
      .filter((r) => normalizeOrderStatus(r.status) !== 'Cancelled')
      .reduce((s, r) => s + r.quantityRequested, 0);
    const pendingUnits = pendingReqs.reduce((s, r) => s + r.quantityRequested, 0);

    const dealerIndentMap = new Map<string, { name: string; count: number; units: number }>();
    requirements.forEach((r) => {
      if (normalizeOrderStatus(r.status) === 'Cancelled') return;
      const cur = dealerIndentMap.get(r.dealerId) || { name: r.dealerCompanyName, count: 0, units: 0 };
      cur.count += 1;
      cur.units += r.quantityRequested;
      dealerIndentMap.set(r.dealerId, cur);
    });
    const topDealers = [...dealerIndentMap.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    const productDemandMap = new Map<string, { name: string; units: number; count: number }>();
    requirements.forEach((r) => {
      if (normalizeOrderStatus(r.status) === 'Cancelled') return;
      const cur = productDemandMap.get(r.productId) || { name: r.productName, units: 0, count: 0 };
      cur.units += r.quantityRequested;
      cur.count += 1;
      productDemandMap.set(r.productId, cur);
    });
    const topProducts = [...productDemandMap.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    const stateMap = new Map<string, number>();
    dealers.forEach((d) => stateMap.set(d.state, (stateMap.get(d.state) || 0) + 1));
    const dealersByState = [...stateMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

    const categoryStock = new Map<string, { units: number; products: number }>();
    activeProducts.forEach((p) => {
      const cur = categoryStock.get(p.category) || { units: 0, products: 0 };
      cur.units += p.availableStock || 0;
      cur.products += 1;
      categoryStock.set(p.category, cur);
    });
    const stockByCategory = [...categoryStock.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.units - a.units);

    const now = Date.now();
    const last30Days = requirements.filter((r) => {
      const t = new Date(r.requestedDate).getTime();
      return now - t <= 30 * 24 * 3600 * 1000 && normalizeOrderStatus(r.status) !== 'Cancelled';
    }).length;

    const recentIndents = [...requirements]
      .sort((a, b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime())
      .slice(0, 8);

    const maxDealerUnits = topDealers[0]?.units || 1;
    const maxProductUnits = topProducts[0]?.units || 1;
    const maxCategoryUnits = stockByCategory[0]?.units || 1;

    return {
      totalStockUnits,
      inventoryValue,
      lowStock,
      outOfStock,
      pendingDealers,
      approvedDealers,
      pendingReqs,
      deliveredReqs,
      activeReqs,
      inProductionReqs,
      totalUnitsRequested,
      pendingUnits,
      topDealers,
      topProducts,
      dealersByState,
      stockByCategory,
      last30Days,
      recentIndents,
      maxDealerUnits,
      maxProductUnits,
      maxCategoryUnits,
    };
  }, [dealers, products, requirements]);

  const kpis = [
    { label: 'Inventory Value', value: fmtCurrency(analytics.inventoryValue), icon: IndianRupee, accent: 'text-[#d4af37]' },
    { label: 'Total Stock Units', value: fmt(analytics.totalStockUnits), icon: Package, accent: 'text-white' },
    { label: 'Pending Orders', value: fmt(analytics.pendingReqs.length), sub: `${fmt(analytics.pendingUnits)} units`, icon: Clock, accent: 'text-[#d66b0f]' },
    { label: 'Active Orders', value: fmt(analytics.activeReqs.length), sub: `${analytics.inProductionReqs.length} in production`, icon: ShoppingBag, accent: 'text-purple-400' },
    { label: 'Approved Dealers', value: fmt(analytics.approvedDealers.length), sub: `${analytics.pendingDealers.length} pending`, icon: Users, accent: 'text-[#d4af37]' },
    { label: 'Orders (30 days)', value: fmt(analytics.last30Days), icon: TrendingUp, accent: 'text-white' },
    { label: 'Low / Out Stock', value: `${analytics.lowStock.length} / ${analytics.outOfStock.length}`, icon: AlertTriangle, accent: 'text-red-400' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, accent }) => (
          <div key={label} className="cf-admin-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-cf-muted font-semibold">{label}</span>
              <Icon className={`w-4 h-4 ${accent}`} />
            </div>
            <p className={`text-xl font-bold ${accent}`}>{value}</p>
            {sub && <p className="text-[10px] text-cf-secondary">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top dealers by indent volume */}
        <div className="cf-admin-card p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-[#d4af37]" />
            Top Dealers by Indent Volume
          </h3>
          {analytics.topDealers.length === 0 ? (
            <p className="text-xs text-cf-muted">No indent data yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.topDealers.map((d, i) => (
                <div key={d.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white font-medium truncate pr-2">
                      {i + 1}. {d.name}
                    </span>
                    <span className="text-[#d4af37] shrink-0">{fmt(d.units)} units · {d.count} indents</span>
                  </div>
                  <div className="h-1.5 bg-[#171717] rounded-full overflow-hidden">
                    <div
                      className="bar-fill h-full bg-gradient-to-r from-[#b65200] to-[#d4af37] rounded-full"
                      style={{ width: `${(d.units / analytics.maxDealerUnits) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top products by demand */}
        <div className="cf-admin-card p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#d4af37]" />
            Most Requested Products
          </h3>
          {analytics.topProducts.length === 0 ? (
            <p className="text-xs text-cf-muted">No product demand data yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.topProducts.map((p, i) => (
                <div key={p.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white font-medium truncate pr-2">{i + 1}. {p.name}</span>
                    <span className="text-[#d4af37] shrink-0">{fmt(p.units)} units</span>
                  </div>
                  <div className="h-1.5 bg-[#171717] rounded-full overflow-hidden">
                    <div
                      className="bar-fill h-full bg-gradient-to-r from-[#b65200] to-[#d4af37] rounded-full"
                      style={{ width: `${(p.units / analytics.maxProductUnits) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock by category */}
        <div className="cf-admin-card p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#d4af37]" />
            Stock by Category
          </h3>
          {analytics.stockByCategory.length === 0 ? (
            <p className="text-xs text-cf-muted">No categories with stock.</p>
          ) : (
            <div className="space-y-3">
              {analytics.stockByCategory.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white">{c.name}</span>
                    <span className="text-cf-secondary">{fmt(c.units)} units · {c.products} SKUs</span>
                  </div>
                  <div className="h-1.5 bg-[#171717] rounded-full overflow-hidden">
                    <div
                      className="bar-fill h-full bg-[#d4af37]/80 rounded-full"
                      style={{ width: `${(c.units / analytics.maxCategoryUnits) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dealers by state */}
        <div className="cf-admin-card p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#d4af37]" />
            Dealer Distribution by State
          </h3>
          {analytics.dealersByState.length === 0 ? (
            <p className="text-xs text-cf-muted">No dealer location data.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {analytics.dealersByState.map(([state, count]) => (
                <div key={state} className="bg-[#171717] rounded-lg px-3 py-2 flex justify-between items-center">
                  <span className="text-xs text-white truncate">{state}</span>
                  <span className="text-sm font-bold text-[#d4af37] ml-2">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts + recent activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="cf-admin-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            Stock Alerts
          </h3>
          {analytics.lowStock.length === 0 && analytics.outOfStock.length === 0 ? (
            <p className="text-xs text-cf-muted">All products adequately stocked.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {analytics.outOfStock.map((p) => (
                <div key={p.id} className="flex justify-between text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <span className="text-white truncate pr-2">{p.name}</span>
                  <span className="text-red-400 shrink-0 font-semibold">Out of stock</span>
                </div>
              ))}
              {analytics.lowStock.map((p) => (
                <div key={p.id} className="flex justify-between text-xs bg-[#b65200]/10 border border-[#b65200]/20 rounded-lg px-3 py-2">
                  <span className="text-white truncate pr-2">{p.name}</span>
                  <span className="text-[#d66b0f] shrink-0 font-semibold">{p.availableStock} left</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cf-admin-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#d4af37]" />
            Recent Orders
          </h3>
          {analytics.recentIndents.length === 0 ? (
            <p className="text-xs text-cf-muted">No orders recorded.</p>
          ) : (
            <div className="space-y-2">
              {analytics.recentIndents.map((r) => {
                const status = normalizeOrderStatus(r.status);
                return (
                <div key={r.id} className="flex items-center justify-between text-xs bg-[#171717] rounded-lg px-3 py-2.5 gap-2">
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{r.productName}</p>
                    <p className="text-cf-muted truncate">{r.dealerCompanyName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[#d4af37] font-semibold">{r.quantityRequested} units</p>
                    <p className={`text-[10px] uppercase font-bold ${
                      status === 'Pending' ? 'text-[#d66b0f]'
                        : status === 'Delivered' ? 'text-green-400'
                        : status === 'Cancelled' ? 'text-red-400'
                        : 'text-cf-secondary'
                    }`}>{orderStatusLabel(r.status)}</p>
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>
      </div>

      {/* Summary row */}
      <div className="cf-admin-card p-4 flex flex-wrap gap-6 text-xs text-cf-secondary">
        <span>Total orders: <strong className="text-white">{requirements.length}</strong></span>
        <span>Delivered: <strong className="text-green-400">{analytics.deliveredReqs.length}</strong></span>
        <span>Active pipeline: <strong className="text-[#d66b0f]">{analytics.activeReqs.length}</strong></span>
        <span>Units requested (all time): <strong className="text-[#d4af37]">{fmt(analytics.totalUnitsRequested)}</strong></span>
        <span>Active SKUs: <strong className="text-white">{products.filter((p) => p.isActive !== false).length}</strong></span>
      </div>
    </div>
  );
}

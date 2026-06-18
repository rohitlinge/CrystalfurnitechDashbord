import React, { useState, useEffect } from 'react';
import { DBService } from '../firebase';
import {
  DealerProfile,
  StockRequirement,
  SalesVisit,
  SalesFollowUp,
  VisitOutcome,
  FollowUpStatus,
} from '../types';
import { getDealerCreditInfo, formatINR } from '../credit';
import BrandLogo from './BrandLogo';
import Toast, { ToastMessage } from './Toast';
import OrderProgress from './OrderProgress';
import {
  isActiveOrder,
  orderStatusBadgeClass,
  orderStatusLabel,
} from '../orders';
import { formatVariantSummaryFromRequirement } from '../variants';
import {
  Users, ClipboardList, MapPin, Bell, LogOut, RefreshCw, Search,
  Plus, X, CheckCircle, Calendar, Phone, Mail, Building2, Briefcase, Edit,
} from 'lucide-react';

interface SalesExecutiveDashboardProps {
  executiveUser: DealerProfile;
  onLogout: () => void;
}

type SalesTab = 'dealers' | 'orders' | 'visits' | 'followups';

const tabLabels: Record<SalesTab, string> = {
  dealers: 'Assigned Dealers',
  orders: 'Orders',
  visits: 'Visits',
  followups: 'Follow Ups',
};

type VisitModalState = {
  mode: 'add' | 'edit';
  visitId?: string;
  dealerId: string;
  dealerCompanyName: string;
  visitDate: string;
  purpose: string;
  notes: string;
  outcome: VisitOutcome;
};

type FollowUpModalState = {
  mode: 'add' | 'edit';
  followUpId?: string;
  dealerId: string;
  dealerCompanyName: string;
  dueDate: string;
  subject: string;
  notes: string;
  status: FollowUpStatus;
};

export default function SalesExecutiveDashboard({ executiveUser, onLogout }: SalesExecutiveDashboardProps) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (message: string, type: ToastMessage['type'] = 'error') =>
    setToast({ id: Date.now(), message, type });

  const [activeTab, setActiveTab] = useState<SalesTab>('dealers');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [dealers, setDealers] = useState<DealerProfile[]>([]);
  const [orders, setOrders] = useState<StockRequirement[]>([]);
  const [visits, setVisits] = useState<SalesVisit[]>([]);
  const [followUps, setFollowUps] = useState<SalesFollowUp[]>([]);

  const [visitModal, setVisitModal] = useState<VisitModalState | null>(null);

  const [followUpModal, setFollowUpModal] = useState<FollowUpModalState | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        DBService.getAssignedDealers(),
        DBService.getStockRequirements(),
        DBService.getVisits(),
        DBService.getFollowUps(),
      ]);
      const firstError = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      if (firstError) {
        const msg = firstError.reason instanceof Error ? firstError.reason.message : 'Failed to load dashboard data.';
        console.error(firstError.reason);
        showToast(msg);
      }
      if (results[0].status === 'fulfilled') setDealers(results[0].value);
      if (results[1].status === 'fulfilled') setOrders(results[1].value);
      if (results[2].status === 'fulfilled') setVisits(results[2].value);
      if (results[3].status === 'fulfilled') setFollowUps(results[3].value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [executiveUser.uid]);

  const searchQ = (searchTerm || '').toLowerCase();
  const matchesSearch = (...values: (string | undefined)[]) =>
    values.some((v) => (v || '').toLowerCase().includes(searchQ));

  const filteredDealers = dealers.filter((d) =>
    matchesSearch(d.companyName, d.ownerName, d.email, d.city, d.state)
  );

  const filteredOrders = orders.filter((o) =>
    matchesSearch(o.dealerCompanyName, o.productName, o.status)
  );

  const filteredVisits = visits.filter((v) =>
    matchesSearch(v.dealerCompanyName, v.purpose, v.notes, v.outcome)
  );

  const filteredFollowUps = followUps.filter((f) =>
    matchesSearch(f.dealerCompanyName, f.subject, f.notes, f.status)
  );

  const pendingFollowUps = followUps.filter((f) => f.status === 'pending').length;
  const activeOrderCount = orders.filter((o) => isActiveOrder(o.status)).length;
  const overdueFollowUps = followUps.filter((f) => f.status === 'pending' && new Date(f.dueDate) < new Date()).length;

  const searchPlaceholder =
    activeTab === 'dealers' ? 'Search assigned dealers...' :
    activeTab === 'orders' ? 'Search orders...' :
    activeTab === 'visits' ? 'Search visits...' :
    'Search follow-ups...';

  const navItems = [
    { id: 'dealers' as const, label: 'Dealers', icon: Users, count: dealers.length },
    { id: 'orders' as const, label: 'Orders', icon: ClipboardList, count: orders.filter((o) => isActiveOrder(o.status)).length },
    { id: 'visits' as const, label: 'Visits', icon: MapPin, count: visits.length },
    { id: 'followups' as const, label: 'Follow Ups', icon: Bell, count: pendingFollowUps },
  ];

  const openAddVisit = (dealer?: DealerProfile) => {
    const d = dealer || dealers[0];
    if (!d) {
      showToast('No assigned dealers to log a visit for.', 'info');
      return;
    }
    setVisitModal({
      mode: 'add',
      dealerId: d.uid,
      dealerCompanyName: d.companyName,
      visitDate: new Date().toISOString().slice(0, 16),
      purpose: '',
      notes: '',
      outcome: 'completed',
    });
  };

  const openAddFollowUp = (dealer?: DealerProfile) => {
    const d = dealer || dealers[0];
    if (!d) {
      showToast('No assigned dealers to schedule a follow-up for.', 'info');
      return;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFollowUpModal({
      mode: 'add',
      dealerId: d.uid,
      dealerCompanyName: d.companyName,
      dueDate: tomorrow.toISOString().slice(0, 10),
      subject: '',
      notes: '',
      status: 'pending',
    });
  };

  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitModal) return;
    try {
      if (visitModal.mode === 'add') {
        await DBService.createVisit({
          dealerId: visitModal.dealerId,
          dealerCompanyName: visitModal.dealerCompanyName,
          visitDate: new Date(visitModal.visitDate).toISOString(),
          purpose: visitModal.purpose,
          notes: visitModal.notes,
          outcome: visitModal.outcome,
        });
        showToast('Visit logged successfully.', 'success');
      } else if (visitModal.visitId) {
        await DBService.updateVisit(visitModal.visitId, {
          dealerId: visitModal.dealerId,
          dealerCompanyName: visitModal.dealerCompanyName,
          visitDate: new Date(visitModal.visitDate).toISOString(),
          purpose: visitModal.purpose,
          notes: visitModal.notes,
          outcome: visitModal.outcome,
        });
        showToast('Visit updated.', 'success');
      }
      setVisitModal(null);
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save visit.');
    }
  };

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpModal) return;
    try {
      if (followUpModal.mode === 'add') {
        await DBService.createFollowUp({
          dealerId: followUpModal.dealerId,
          dealerCompanyName: followUpModal.dealerCompanyName,
          dueDate: new Date(followUpModal.dueDate).toISOString(),
          subject: followUpModal.subject,
          notes: followUpModal.notes,
        });
        showToast('Follow-up scheduled.', 'success');
      } else if (followUpModal.followUpId) {
        await DBService.updateFollowUp(followUpModal.followUpId, {
          dealerId: followUpModal.dealerId,
          dealerCompanyName: followUpModal.dealerCompanyName,
          dueDate: new Date(followUpModal.dueDate).toISOString(),
          subject: followUpModal.subject,
          notes: followUpModal.notes,
          status: followUpModal.status,
          ...(followUpModal.status === 'completed' ? { completedDate: new Date().toISOString() } : {}),
        });
        showToast('Follow-up updated.', 'success');
      }
      setFollowUpModal(null);
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save follow-up.');
    }
  };

  const handleCompleteFollowUp = async (f: SalesFollowUp) => {
    try {
      await DBService.updateFollowUp(f.id, { status: 'completed', completedDate: new Date().toISOString() });
      showToast('Follow-up marked complete.', 'success');
      await fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update follow-up.');
    }
  };

  return (
    <div className="cf-admin min-h-screen flex">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Desktop sidebar */}
      <aside className="cf-admin-sidebar hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen border-r border-white/10">
        <div className="p-5 border-b border-white/10 flex flex-col items-center gap-1.5">
          <BrandLogo size="md" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-cf-muted">Sales Team</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setActiveTab(id); setSearchTerm(''); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                activeTab === id ? 'cf-admin-nav-active' : 'text-white/70 cf-admin-nav-item'
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${activeTab === id ? 'bg-[#222222]/20' : 'bg-[#222222]/10'}`}>
                {count}
              </span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-3">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Field executive</p>
            <p className="text-sm font-semibold text-white truncate">{executiveUser.ownerName}</p>
            <p className="text-[10px] text-[#d4af37] truncate mt-0.5 flex items-center gap-1">
              <Briefcase className="w-3 h-3 shrink-0" />
              {executiveUser.territory || executiveUser.companyName}
            </p>
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
        <header className="lg:hidden cf-admin-sidebar px-4 py-3 flex items-center justify-between sticky top-0 z-20 border-b border-white/10 pr-14">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-cf-muted">Sales</span>
          </div>
          <button type="button" onClick={onLogout} className="p-2 rounded-lg border border-white/20 cursor-pointer">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Desktop page header */}
          <div className="hidden lg:flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h1 className="text-2xl font-semibold text-white">{tabLabels[activeTab]}</h1>
              <p className="text-sm text-cf-secondary">Crystal Furnitech · Field sales workspace</p>
            </div>
            <BrandLogo size="sm" />
          </div>

          {/* Mobile tabs + toolbar */}
          <div className="lg:hidden cf-admin-card p-4 space-y-3">
            <div className="flex flex-wrap gap-2 bg-[#171717] p-1 border border-white/10 rounded-lg">
              {navItems.map(({ id, label, icon: Icon, count }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setActiveTab(id); setSearchTerm(''); }}
                  className={`py-2 px-3 rounded-md font-semibold text-[11px] tracking-wide transition flex items-center gap-2 cursor-pointer ${
                    activeTab === id
                      ? 'bg-gradient-to-r from-[#b65200] to-[#d66b0f] text-white shadow-md'
                      : 'text-cf-muted hover:text-[#d4af37]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label} ({count})
                </button>
              ))}
            </div>
            <ToolbarRow />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Assigned Dealers" value={dealers.length} accent="gold" />
            <StatCard icon={ClipboardList} label="Active Orders" value={activeOrderCount} accent="orange" />
            <StatCard icon={MapPin} label="Visits Logged" value={visits.length} accent="green" />
            <StatCard icon={Bell} label="Pending Follow Ups" value={pendingFollowUps} accent={overdueFollowUps > 0 ? 'red' : 'amber'} sub={overdueFollowUps > 0 ? `${overdueFollowUps} overdue` : undefined} />
          </div>

          {/* Desktop toolbar */}
          <div className="hidden lg:block cf-admin-card p-4">
            <ToolbarRow />
          </div>

          {/* Tab content */}
          {activeTab === 'dealers' && (
            <>
              {filteredDealers.length === 0 ? (
                <EmptyState icon={Users} title="No dealers assigned yet" hint="Contact admin to assign dealers to your territory." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredDealers.map((d) => {
                    const credit = getDealerCreditInfo(d);
                    const dealerOrders = orders.filter((o) => o.dealerId === d.uid);
                    const activeOrders = dealerOrders.filter((o) => isActiveOrder(o.status)).length;
                    return (
                      <article key={d.uid} className="cf-admin-card p-5 space-y-4 hover:border-[#d4af37]/30 transition">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 truncate">
                              <Building2 className="w-4 h-4 text-[#d4af37] shrink-0" />
                              {d.companyName}
                            </h3>
                            <p className="text-xs text-cf-muted mt-0.5">{d.ownerName}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25">
                            {d.status}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs text-cf-secondary">
                          <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-cf-muted shrink-0" /> {d.mobile}</p>
                          <p className="flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5 text-cf-muted shrink-0" /> {d.email}</p>
                          <p>{d.city}, {d.state}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                          <div className="bg-[#171717] rounded-lg p-3 border border-white/10 text-center">
                            <p className="text-[10px] text-cf-muted uppercase font-semibold">Active Orders</p>
                            <p className="text-xl font-semibold text-white mt-1">{activeOrders}</p>
                          </div>
                          <div className="bg-[#171717] rounded-lg p-3 border border-white/10 text-center">
                            <p className="text-[10px] text-cf-muted uppercase font-semibold">Credit Left</p>
                            <p className="text-sm font-bold text-[#d4af37] mt-1">{formatINR(credit.availableCredit)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => openAddVisit(d)} className="flex-1 py-2.5 text-[10px] font-bold rounded-lg border border-white/10 hover:bg-white/5 text-white transition cursor-pointer">
                            Log Visit
                          </button>
                          <button type="button" onClick={() => openAddFollowUp(d)} className="flex-1 py-2.5 text-[10px] font-bold rounded-lg cf-btn-brand">
                            Follow Up
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'orders' && (
            <div className="cf-admin-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs cf-admin-table">
                  <thead>
                    <tr>
                      <th className="py-3 px-5 text-left">Dealer</th>
                      <th className="py-3 px-5 text-left">Product</th>
                      <th className="py-3 px-5 text-left">Qty</th>
                      <th className="py-3 px-5 text-left">Value</th>
                      <th className="py-3 px-5 text-left">Status</th>
                      <th className="py-3 px-5 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr><td colSpan={6} className="py-12 text-center text-cf-muted">No orders from assigned dealers.</td></tr>
                    ) : filteredOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="py-4 px-5 font-semibold text-white">{o.dealerCompanyName}</td>
                        <td className="py-4 px-5">
                          <span className="cf-td-title block">{o.productName}</span>
                          {formatVariantSummaryFromRequirement(o) && (
                            <span className="text-[10px] text-cf-muted mt-0.5 block">{formatVariantSummaryFromRequirement(o)}</span>
                          )}
                        </td>
                        <td className="py-4 px-5">{o.quantityRequested}</td>
                        <td className="py-4 px-5 cf-td-mono">{o.orderValue ? formatINR(o.orderValue) : '—'}</td>
                        <td className="py-4 px-5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${orderStatusBadgeClass(o.status)}`}>
                            {orderStatusLabel(o.status)}
                          </span>
                          <div className="mt-2 max-w-[180px]"><OrderProgress status={o.status} compact /></div>
                        </td>
                        <td className="py-4 px-5 cf-td-date">
                          {new Date(o.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'visits' && (
            <div className="space-y-3">
              {filteredVisits.length === 0 ? (
                <EmptyState icon={MapPin} title="No visits logged yet" hint="Log field visits to track dealer relationships." actionLabel="Log your first visit" onAction={() => openAddVisit()} />
              ) : filteredVisits.map((v) => (
                <div key={v.id} className="cf-admin-card p-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{v.dealerCompanyName}</p>
                    <p className="text-xs text-[#d4af37] font-semibold">{v.purpose}</p>
                    {v.notes && <p className="text-xs text-cf-secondary max-w-lg">{v.notes}</p>}
                    <p className="text-[10px] text-cf-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(v.visitDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <OutcomeBadge outcome={v.outcome} />
                    <button
                      type="button"
                      onClick={() => setVisitModal({
                        mode: 'edit',
                        visitId: v.id,
                        dealerId: v.dealerId,
                        dealerCompanyName: v.dealerCompanyName,
                        visitDate: v.visitDate.slice(0, 16),
                        purpose: v.purpose,
                        notes: v.notes,
                        outcome: v.outcome,
                      })}
                      className="p-1.5 border border-white/10 rounded-lg hover:bg-zinc-800 text-white transition cursor-pointer"
                      title="Edit visit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'followups' && (
            <div className="space-y-3">
              {filteredFollowUps.length === 0 ? (
                <EmptyState icon={Bell} title="No follow-ups scheduled" hint="Schedule follow-ups to stay on top of dealer actions." actionLabel="Schedule a follow-up" onAction={() => openAddFollowUp()} />
              ) : filteredFollowUps.map((f) => {
                const isOverdue = f.status === 'pending' && new Date(f.dueDate) < new Date();
                return (
                  <div key={f.id} className={`cf-admin-card p-4 flex flex-wrap items-start justify-between gap-3 ${isOverdue ? 'border-red-500/30' : ''}`}>
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{f.subject}</p>
                      <p className="text-xs text-cf-muted">{f.dealerCompanyName}</p>
                      {f.notes && <p className="text-xs text-cf-secondary">{f.notes}</p>}
                      <p className="text-[10px] text-cf-muted flex items-center gap-1 flex-wrap">
                        <Calendar className="w-3 h-3" />
                        Due {new Date(f.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {isOverdue && <span className="text-red-400 font-bold">· OVERDUE</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <FollowUpStatusBadge status={f.status} />
                      {f.status === 'pending' && (
                        <button type="button" onClick={() => handleCompleteFollowUp(f)} className="flex items-center gap-1 text-[10px] font-bold text-[#10b981] px-2.5 py-1.5 border border-[#10b981]/30 rounded-lg cursor-pointer hover:bg-[#10b981]/10 transition">
                          <CheckCircle className="w-3 h-3" /> Done
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setFollowUpModal({
                          mode: 'edit',
                          followUpId: f.id,
                          dealerId: f.dealerId,
                          dealerCompanyName: f.dealerCompanyName,
                          dueDate: f.dueDate.slice(0, 10),
                          subject: f.subject,
                          notes: f.notes,
                          status: f.status,
                        })}
                        className="p-1.5 border border-white/10 rounded-lg hover:bg-zinc-800 text-white transition cursor-pointer"
                        title="Edit follow-up"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {visitModal && <VisitModal dealers={dealers} visitModal={visitModal} setVisitModal={setVisitModal} onSubmit={handleSaveVisit} />}
      {followUpModal && <FollowUpModal dealers={dealers} followUpModal={followUpModal} setFollowUpModal={setFollowUpModal} onSubmit={handleSaveFollowUp} />}
    </div>
  );

  function ToolbarRow() {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative grow sm:w-60">
          <Search className="w-4 h-4 text-cf-muted absolute left-3 top-3.5" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="cf-input w-full pl-9 pr-4 py-3 text-xs"
          />
        </div>
        {activeTab === 'visits' && (
          <button type="button" onClick={() => openAddVisit()} className="py-3 px-4 cf-btn-brand text-xs rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
            <Plus className="w-4 h-4" /> Log Visit
          </button>
        )}
        {activeTab === 'followups' && (
          <button type="button" onClick={() => openAddFollowUp()} className="py-3 px-4 cf-btn-brand text-xs rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
            <Plus className="w-4 h-4" /> Add Follow Up
          </button>
        )}
        <button type="button" onClick={fetchData} disabled={loading} title="Refresh" className="p-3 cf-input hover:border-[#d4af37] rounded-lg cursor-pointer transition disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 text-[#d4af37] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: 'gold' | 'orange' | 'green' | 'amber' | 'red';
  sub?: string;
}) {
  const styles = {
    gold: { border: 'border-l-[#d4af37]', icon: 'text-[#d4af37] bg-[#171717] border-white/10' },
    orange: { border: 'border-l-[#b65200]', icon: 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20' },
    green: { border: 'border-l-[#10b981]', icon: 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20' },
    amber: { border: 'border-l-[#f59e0b]', icon: 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20' },
    red: { border: 'border-l-[#ef4444]', icon: 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20' },
  }[accent];

  return (
    <div className={`cf-admin-card p-5 rounded-xl flex items-center gap-4 border-l-2 ${styles.border}`}>
      <div className={`p-3 rounded-lg border ${styles.icon}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <span className="text-[10px] text-cf-muted font-semibold block uppercase">{label}</span>
        <span className="text-2xl font-semibold text-white">{value}</span>
        {sub && <span className="text-[10px] text-red-400 font-semibold block mt-0.5">{sub}</span>}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="cf-admin-card py-16 text-center">
      <Icon className="w-10 h-10 mx-auto mb-3 text-cf-muted opacity-40" />
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-cf-muted mt-1 max-w-sm mx-auto">{hint}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="mt-4 text-[#d4af37] font-bold text-xs hover:underline cursor-pointer">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: VisitOutcome }) {
  const cls =
    outcome === 'completed' ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25' :
    outcome === 'scheduled' ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/25' :
    'bg-zinc-700/50 text-zinc-400 border-white/10';
  return <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${cls}`}>{outcome}</span>;
}

function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  const cls =
    status === 'completed' ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25' :
    status === 'pending' ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/25' :
    'bg-zinc-700/50 text-zinc-400 border-white/10';
  return <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${cls}`}>{status}</span>;
}

function VisitModal({
  dealers,
  visitModal,
  setVisitModal,
  onSubmit,
}: {
  dealers: DealerProfile[];
  visitModal: VisitModalState;
  setVisitModal: React.Dispatch<React.SetStateAction<VisitModalState | null>>;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-[#222222] rounded-xl border border-white/10 max-w-md w-full shadow-2xl animate-fade-in overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#b65200] via-[#d4af37] to-[#b65200]" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#d4af37]" />
              {visitModal.mode === 'add' ? 'Log Visit' : 'Edit Visit'}
            </h4>
            <button type="button" onClick={() => setVisitModal(null)} className="text-cf-muted hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={onSubmit} className="space-y-3 text-xs">
            <ModalField label="Dealer">
              <select
                value={visitModal.dealerId}
                onChange={(e) => {
                  const d = dealers.find((x) => x.uid === e.target.value);
                  setVisitModal((prev) => prev ? { ...prev, dealerId: e.target.value, dealerCompanyName: d?.companyName || '' } : null);
                }}
                className="cf-input w-full py-2.5"
              >
                {dealers.map((d) => <option key={d.uid} value={d.uid}>{d.companyName}</option>)}
              </select>
            </ModalField>
            <ModalField label="Visit Date & Time">
              <input type="datetime-local" required value={visitModal.visitDate} onChange={(e) => setVisitModal((p) => p ? { ...p, visitDate: e.target.value } : null)} className="cf-input w-full py-2.5" />
            </ModalField>
            <ModalField label="Purpose">
              <input type="text" required value={visitModal.purpose} onChange={(e) => setVisitModal((p) => p ? { ...p, purpose: e.target.value } : null)} placeholder="e.g. Order follow-up, catalog pitch" className="cf-input w-full py-2.5" />
            </ModalField>
            <ModalField label="Notes">
              <textarea value={visitModal.notes} onChange={(e) => setVisitModal((p) => p ? { ...p, notes: e.target.value } : null)} rows={3} className="cf-input w-full py-2.5 resize-none" />
            </ModalField>
            <ModalField label="Outcome">
              <select value={visitModal.outcome} onChange={(e) => setVisitModal((p) => p ? { ...p, outcome: e.target.value as VisitOutcome } : null)} className="cf-input w-full py-2.5">
                <option value="completed">Completed</option>
                <option value="scheduled">Scheduled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </ModalField>
            <button type="submit" className="w-full py-3 cf-btn-brand rounded-lg font-bold cursor-pointer">Save Visit</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function FollowUpModal({
  dealers,
  followUpModal,
  setFollowUpModal,
  onSubmit,
}: {
  dealers: DealerProfile[];
  followUpModal: FollowUpModalState;
  setFollowUpModal: React.Dispatch<React.SetStateAction<FollowUpModalState | null>>;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-[#222222] rounded-xl border border-white/10 max-w-md w-full shadow-2xl animate-fade-in overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#b65200] via-[#d4af37] to-[#b65200]" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-[#d4af37]" />
              {followUpModal.mode === 'add' ? 'Schedule Follow Up' : 'Edit Follow Up'}
            </h4>
            <button type="button" onClick={() => setFollowUpModal(null)} className="text-cf-muted hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={onSubmit} className="space-y-3 text-xs">
            <ModalField label="Dealer">
              <select
                value={followUpModal.dealerId}
                onChange={(e) => {
                  const d = dealers.find((x) => x.uid === e.target.value);
                  setFollowUpModal((prev) => prev ? { ...prev, dealerId: e.target.value, dealerCompanyName: d?.companyName || '' } : null);
                }}
                className="cf-input w-full py-2.5"
              >
                {dealers.map((d) => <option key={d.uid} value={d.uid}>{d.companyName}</option>)}
              </select>
            </ModalField>
            <ModalField label="Due Date">
              <input type="date" required value={followUpModal.dueDate} onChange={(e) => setFollowUpModal((p) => p ? { ...p, dueDate: e.target.value } : null)} className="cf-input w-full py-2.5" />
            </ModalField>
            <ModalField label="Subject">
              <input type="text" required value={followUpModal.subject} onChange={(e) => setFollowUpModal((p) => p ? { ...p, subject: e.target.value } : null)} placeholder="e.g. Collect payment, confirm order" className="cf-input w-full py-2.5" />
            </ModalField>
            <ModalField label="Notes">
              <textarea value={followUpModal.notes} onChange={(e) => setFollowUpModal((p) => p ? { ...p, notes: e.target.value } : null)} rows={3} className="cf-input w-full py-2.5 resize-none" />
            </ModalField>
            {followUpModal.mode === 'edit' && (
              <ModalField label="Status">
                <select value={followUpModal.status} onChange={(e) => setFollowUpModal((p) => p ? { ...p, status: e.target.value as FollowUpStatus } : null)} className="cf-input w-full py-2.5">
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </ModalField>
            )}
            <button type="submit" className="w-full py-3 cf-btn-brand rounded-lg font-bold cursor-pointer">Save Follow Up</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

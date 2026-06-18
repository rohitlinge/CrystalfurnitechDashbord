import React, { useState } from 'react';
import { DBService } from '../firebase';
import { DealerProfile } from '../types';
import { Briefcase, Plus, Trash2, UserCheck, X } from 'lucide-react';

interface AdminSalesTeamProps {
  executives: DealerProfile[];
  dealers: DealerProfile[];
  onRefresh: () => Promise<void>;
  showToast: (message: string, type?: 'error' | 'success' | 'info') => void;
}

export default function AdminSalesTeam({ executives, dealers, onRefresh, showToast }: AdminSalesTeamProps) {
  const [executiveModal, setExecutiveModal] = useState<{
    name: string;
    email: string;
    mobile: string;
    password: string;
    territory: string;
  } | null>(null);

  const [assignModal, setAssignModal] = useState<{
    executiveId: string;
    executiveName: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);

  const approvedDealers = dealers.filter((d) => d.status === 'Approved');

  const handleAddExecutive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!executiveModal) return;
    setSaving(true);
    try {
      await DBService.addSalesExecutive({
        name: executiveModal.name,
        email: executiveModal.email,
        mobile: executiveModal.mobile,
        password: executiveModal.password,
        territory: executiveModal.territory,
      });
      showToast('Sales executive created.', 'success');
      setExecutiveModal(null);
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create sales executive.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExecutive = async (uid: string, name: string) => {
    if (!window.confirm(`Remove sales executive "${name}"? Assigned dealers will be unlinked.`)) return;
    try {
      const assigned = approvedDealers.filter((d) => d.assignedExecutiveId === uid);
      await Promise.all(assigned.map((d) => DBService.assignDealerToExecutive(d.uid, null)));
      await DBService.deleteSalesExecutive(uid);
      showToast('Sales executive removed.', 'info');
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete sales executive.');
    }
  };

  const handleAssignDealer = async (dealerId: string, executiveId: string | null) => {
    const exec = executives.find((e) => e.uid === executiveId);
    try {
      await DBService.assignDealerToExecutive(dealerId, executiveId, exec?.ownerName);
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign dealer.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#d4af37]" />
            Sales Team
          </h2>
          <p className="text-xs text-cf-muted mt-1">Create field sales executives and assign dealers to them.</p>
        </div>
        <button
          type="button"
          onClick={() => setExecutiveModal({ name: '', email: '', mobile: '', password: '', territory: '' })}
          className="flex items-center gap-1.5 px-4 py-2.5 cf-btn-brand text-xs font-bold rounded-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Sales Executive
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="cf-admin-card overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Sales Executives ({executives.length})</h3>
          </div>
          <div className="divide-y divide-white/5">
            {executives.length === 0 ? (
              <p className="p-6 text-sm text-cf-muted text-center">No sales executives yet.</p>
            ) : executives.map((exec) => {
              const assignedCount = approvedDealers.filter((d) => d.assignedExecutiveId === exec.uid).length;
              return (
                <div key={exec.uid} className="p-4 flex items-start justify-between gap-3 hover:bg-white/[0.02]">
                  <div>
                    <p className="text-sm font-bold text-white">{exec.ownerName}</p>
                    <p className="text-xs text-cf-muted">{exec.email}</p>
                    <p className="text-[10px] text-[#d4af37] mt-1">{exec.territory || exec.companyName}</p>
                    <p className="text-[10px] text-cf-muted mt-1">{assignedCount} dealer{assignedCount !== 1 ? 's' : ''} assigned</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      title="Manage assignments"
                      onClick={() => setAssignModal({ executiveId: exec.uid, executiveName: exec.ownerName })}
                      className="p-1.5 border border-white/10 rounded-lg hover:bg-[#10b981]/20 text-[#10b981] cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Remove executive"
                      onClick={() => handleDeleteExecutive(exec.uid, exec.ownerName)}
                      className="p-1.5 border border-white/10 rounded-lg hover:bg-red-500/20 text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cf-admin-card overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Dealer Assignments</h3>
          </div>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-xs cf-admin-table">
              <thead className="sticky top-0 bg-[#222222]">
                <tr className="border-b border-white/10 text-cf-muted uppercase text-[10px]">
                  <th className="py-2.5 px-4 text-left">Dealer</th>
                  <th className="py-2.5 px-4 text-left">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {approvedDealers.length === 0 ? (
                  <tr><td colSpan={2} className="py-8 text-center text-cf-muted">No approved dealers.</td></tr>
                ) : approvedDealers.map((d) => (
                  <tr key={d.uid} className="border-b border-white/5">
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-white">{d.companyName}</span>
                      <span className="block text-[10px] text-cf-muted">{d.city}, {d.state}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <select
                        value={d.assignedExecutiveId || ''}
                        onChange={(e) => handleAssignDealer(d.uid, e.target.value || null)}
                        className="cf-input w-full max-w-[180px] py-2 text-[11px]"
                      >
                        <option value="">Unassigned</option>
                        {executives.map((exec) => (
                          <option key={exec.uid} value={exec.uid}>{exec.ownerName}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {executiveModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#222222] rounded-xl border border-white/10 max-w-md w-full shadow-2xl animate-fade-in overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#b65200] via-[#d4af37] to-[#b65200]" />
            <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-[#d4af37]" />
                Add Sales Executive
              </h4>
              <button type="button" onClick={() => setExecutiveModal(null)} className="text-cf-muted hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAddExecutive} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-cf-muted uppercase">Full Name</label>
                <input required type="text" value={executiveModal.name} onChange={(e) => setExecutiveModal({ ...executiveModal, name: e.target.value })} className="cf-input w-full mt-1 py-2.5" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-cf-muted uppercase">Email</label>
                <input required type="email" value={executiveModal.email} onChange={(e) => setExecutiveModal({ ...executiveModal, email: e.target.value })} className="cf-input w-full mt-1 py-2.5" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-cf-muted uppercase">Mobile</label>
                <input required type="tel" value={executiveModal.mobile} onChange={(e) => setExecutiveModal({ ...executiveModal, mobile: e.target.value })} className="cf-input w-full mt-1 py-2.5" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-cf-muted uppercase">Territory / Region</label>
                <input type="text" value={executiveModal.territory} onChange={(e) => setExecutiveModal({ ...executiveModal, territory: e.target.value })} placeholder="e.g. West Maharashtra" className="cf-input w-full mt-1 py-2.5" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-cf-muted uppercase">Password</label>
                <input required type="password" minLength={6} value={executiveModal.password} onChange={(e) => setExecutiveModal({ ...executiveModal, password: e.target.value })} className="cf-input w-full mt-1 py-2.5" />
              </div>
              <button type="submit" disabled={saving} className="w-full py-3 cf-btn-brand rounded-lg font-bold cursor-pointer disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Executive'}
              </button>
            </form>
            </div>
          </div>
        </div>
      )}

      {assignModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#222222] rounded-xl border border-white/10 max-w-lg w-full shadow-2xl animate-fade-in overflow-hidden max-h-[80vh] flex flex-col">
            <div className="h-1 bg-gradient-to-r from-[#b65200] via-[#d4af37] to-[#b65200]" />
            <div className="p-6 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#d4af37]" />
                Assign Dealers — {assignModal.executiveName}
              </h4>
              <button type="button" onClick={() => setAssignModal(null)} className="text-cf-muted hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {approvedDealers.map((d) => {
                const isAssigned = d.assignedExecutiveId === assignModal.executiveId;
                const assignedElsewhere = d.assignedExecutiveId && d.assignedExecutiveId !== assignModal.executiveId;
                return (
                  <label key={d.uid} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    isAssigned ? 'border-[#10b981]/40 bg-[#10b981]/10' : 'border-white/10 hover:bg-white/5'
                  }`}>
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      disabled={!!assignedElsewhere}
                      onChange={(e) => handleAssignDealer(d.uid, e.target.checked ? assignModal.executiveId : null)}
                      className="w-4 h-4 accent-[#b65200]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{d.companyName}</p>
                      <p className="text-[10px] text-cf-muted">{d.city}, {d.state}</p>
                      {assignedElsewhere && (
                        <p className="text-[10px] text-amber-400">Assigned to {d.assignedExecutiveName}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

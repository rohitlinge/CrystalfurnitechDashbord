import React, { useState } from 'react';
import { DBService } from '../firebase';
import { DealerProfile } from '../types';
import { Mail, Lock, LogIn, Sparkles, Building, CheckCircle, Shield, AlertTriangle, AlertOctagon } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: DealerProfile) => void;
  onGoToRegister: () => void;
}

export default function Login({ onLoginSuccess, onGoToRegister }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'pending' | 'rejected' | 'suspended';
    message: string;
    details?: string;
  } | null>(null);

  const [useMock, setUseMock] = useState(DBService.isMockMode());
  const [seedingText, setSeedingText] = useState<string | null>(null);
  const [seedingSuccess, setSeedingSuccess] = useState<boolean>(false);

  const handleInstantSeed = async () => {
    setError(null);
    setSeedingText("Initializing Admin & Seeding categories/products to live Firestore...");
    setSeedingSuccess(false);
    try {
      await DBService.initializeAndSeedLiveDb();
      setSeedingSuccess(true);
      setSeedingText("Success! Database has been initialized. Check your Firebase console Firestore tab to see 'categories', 'products', and 'dealers' collections!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to seed live database.");
      setSeedingText(null);
    }
  };

  const handleToggleMode = () => {
    const nextMock = !useMock;
    DBService.setMockMode(nextMock);
    setUseMock(nextMock);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (!email || !password) {
      setError("Please fill in both Email and Password fields.");
      return;
    }

    setLoading(true);

    try {
      const user = await DBService.login(email, password);

      // Evaluate account approval constraints if this is a dealer
      if (user.role === 'dealer') {
        if (user.status === 'Pending Approval') {
          setStatusMessage({
            type: 'pending',
            message: "Your account is currently under verification.",
            details: "Please wait for approval from Crystal Furnitech backoffice managers."
          });
          setLoading(false);
          return;
        } else if (user.status === 'Rejected') {
          setStatusMessage({
            type: 'rejected',
            message: "Your account has not been approved.",
            details: user.rejectionReason || "Please contact Crystal Furnitech support at support@crystalfurnitech.com."
          });
          setLoading(false);
          return;
        } else if (user.status === 'Suspended') {
          setStatusMessage({
            type: 'suspended',
            message: "Your dealer account is temporarily suspended.",
            details: user.suspensionReason || "Please contact Crystal Furnitech sales support to resolve pending balances or document mismatches."
          });
          setLoading(false);
          return;
        }
      }

      onLoginSuccess(user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Invalid credentials. Please attempt again.");
    } finally {
      setLoading(false);
    }
  };

  // Helper trigger for quick demo logins to simplify review
  const triggerQuickLogin = async (demoEmail: string, demoPassword?: string) => {
    setError(null);
    setStatusMessage(null);
    setLoading(true);
    try {
      const user = await DBService.login(demoEmail, demoPassword || 'dealer123');
      
      if (user.role === 'dealer') {
        if (user.status === 'Pending Approval') {
          setStatusMessage({
            type: 'pending',
            message: "Your account is currently under verification.",
            details: "Please wait for approval from Crystal Furnitech backoffice managers."
          });
          setLoading(false);
          return;
        } else if (user.status === 'Rejected') {
          setStatusMessage({
            type: 'rejected',
            message: "Your account has not been approved.",
            details: user.rejectionReason || "Please contact support@crystalfurnitech.com."
          });
          setLoading(false);
          return;
        } else if (user.status === 'Suspended') {
          setStatusMessage({
            type: 'suspended',
            message: "Your dealer account is temporarily suspended.",
            details: user.suspensionReason || "Contact admin to lift limits."
          });
          setLoading(false);
          return;
        }
      }
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || "Credential bypass failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      
      {/* Cloud Database Initializer & Seeder */}
      <div className="bg-zinc-900 border border-emerald-500/30 rounded-xl p-5 shadow-xl space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl"></div>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Live Firestore Initializer</h4>
            <p className="text-[10px] text-zinc-400">Setup administrative login credentials and live database schema</p>
          </div>
        </div>

        <p className="text-[11px] text-zinc-300 leading-relaxed">
          Hello Rohit! Your active database starts with no collections. Click the button below to register the administrative account <code className="text-emerald-400 font-mono">admin@crystalfurnitech.com</code> and auto-populate your <code className="text-emerald-400 font-mono">/categories</code> and <code className="text-emerald-400 font-mono">/products</code> collections into your Firestore:
        </p>

        {seedingText && (
          <div className={`p-3 rounded-lg border text-[11px] leading-relaxed ${
            seedingSuccess 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md' 
              : 'bg-zinc-800 border-zinc-700 text-zinc-300 animate-pulse'
          }`}>
            <div className="flex gap-2">
              <span className="mt-0.5 font-bold">●</span>
              <span>{seedingText}</span>
            </div>
          </div>
        )}

        <button
          id="btn-live-init-seed"
          type="button"
          onClick={handleInstantSeed}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-lg transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
        >
          <Sparkles className="w-3.5 h-3.5 text-zinc-950" />
          🚀 Initialize & Seed Live Database Now
        </button>
      </div>

      {/* Real-time DB vs Mock DB Toggle Ribbon for audit clarity */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4 text-xs text-[#a1a1aa] shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-[#fafafa]">
            <Sparkles className="w-4 h-4 text-[#f59e0b]" />
            <span>Connection: </span>
            <span className={useMock ? "text-[#f59e0b] font-bold" : "text-[#10b981] font-bold"}>
              {useMock ? "Offline Sandbox" : "Real Live Firebase"}
            </span>
          </div>
          <button
            id="btn-toggle-db-mode"
            type="button"
            onClick={handleToggleMode}
            className="text-[10px] bg-transparent hover:bg-[#fafafa] hover:text-[#09090b] text-[#fafafa] py-1 px-2.5 rounded border border-[#27272a] transition duration-200"
          >
            Switch to {useMock ? "Live" : "Local Sandbox"}
          </button>
        </div>
        <p className="text-[11px] text-[#a1a1aa] mt-2 leading-relaxed">
          {useMock 
            ? "Offline Sandbox uses localized mock database to evaluate Pending, Approved, and Suspended dealer flows instantly." 
            : "Connects with the crystal-furnitech Firestore project directly using Firebase config."}
        </p>
      </div>

      <div className="bg-[#18181b] rounded-xl border border-[#27272a] overflow-hidden shadow-2xl">
        
        {/* Portal Header branding */}
        <div className="bg-zinc-950/40 p-8 border-b border-[#27272a] text-center">
          <div className="inline-flex w-12 h-12 bg-[#27272a]/40 rounded-xl items-center justify-center mb-3 border border-[#27272a]">
            <Building className="w-5 h-5 text-[#fafafa]" />
          </div>
          <h1 id="portal-title" className="font-serif italic text-2xl tracking-tight text-[#fafafa] font-medium">Crystal Furnitech</h1>
          <p id="portal-sub" className="text-[#a1a1aa] text-xs mt-1">B2B Wholesale Furniture Dealer Portal</p>
        </div>

        <div className="p-8 space-y-5">
          
          {/* Status Restriction Message */}
          {statusMessage && (
            <div id="status-alert-box" className={`p-4 rounded-lg border flex gap-3 text-xs leading-relaxed ${
              statusMessage.type === 'pending' 
                ? 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]' 
                : statusMessage.type === 'rejected' 
                ? 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
            }`}>
              <div className="shrink-0 mt-0.5">
                {statusMessage.type === 'pending' ? (
                  <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
                ) : statusMessage.type === 'rejected' ? (
                  <AlertOctagon className="w-5 h-5 text-[#ef4444]" />
                ) : (
                  <AlertOctagon className="w-5 h-5 text-amber-500" />
                )}
              </div>
              <div>
                <p className="font-semibold text-[#fafafa] mb-0.5">{statusMessage.message}</p>
                <p className="text-[#a1a1aa]">{statusMessage.details}</p>
                {statusMessage.type === 'pending' && (
                  <span className="inline-block mt-2 font-semibold bg-[#f59e0b]/20 text-[#f59e0b] px-2 py-0.5 rounded text-[10px] border border-[#f59e0b]/30">
                    Status: PENDING VERIFICATION
                  </span>
                )}
              </div>
            </div>
          )}

          {error && (
            <div id="login-error" className="bg-[#ef4444]/10 text-[#ef4444] text-xs font-medium py-3 px-4 rounded-lg border border-[#ef4444]/30 leading-snug">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#a1a1aa] block">Registered Dealer Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                <input 
                  id="login-email"
                  type="email"
                  required
                  placeholder="name@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm bg-[#09090b] border border-[#27272a] text-[#fafafa] placeholder-zinc-500 rounded-lg focus:border-[#fafafa] outline-none transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-[#a1a1aa]">Password</label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                <input 
                  id="login-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm bg-[#09090b] border border-[#27272a] text-[#fafafa] placeholder-zinc-500 rounded-lg focus:border-[#fafafa] outline-none transition"
                />
              </div>
            </div>

            <button 
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#fafafa] text-[#09090b] hover:bg-[#a1a1aa] hover:text-[#09090b] disabled:bg-[#27272a] disabled:text-[#a1a1aa] disabled:cursor-not-allowed font-semibold text-sm rounded-lg transition duration-200 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#09090b] border-t-transparent rounded-full animate-spin"></div>
                  Logging In...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Access Dealer Portal
                </>
              )}
            </button>
          </form>

          {/* Registration Redirect info */}
          <div className="text-center pt-2 text-xs text-[#a1a1aa]">
            <span>New dealer partner with Crystal Furnitech? </span>
            <button 
              id="btn-p-reg"
              type="button"
              onClick={onGoToRegister}
              className="text-[#fafafa] font-bold hover:underline cursor-pointer"
            >
              Register Account Here
            </button>
          </div>

        </div>
      </div>

      {/* Quick Access panel for high value testing and evaluation */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 shadow-lg space-y-3">
        <h3 id="quick-login-section" className="text-xs font-bold text-[#fafafa] tracking-wider uppercase flex items-center gap-1">
          <Shield className="w-4 h-4 text-[#a1a1aa]" />
          Wholesale Evaluation Quick Logins
        </h3>
        <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
          Instantly simulate different B2B dealer states and backoffice controls:
        </p>
        
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          
          <button
            id="demo-admin"
            type="button"
            onClick={() => triggerQuickLogin('admin@crystalfurnitech.com', 'admin123')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#09090b]/50 hover:bg-[#fafafa] hover:text-[#09090b] text-[#fafafa] rounded-lg border border-[#27272a] font-medium transition duration-200"
          >
            <Shield className="w-3.5 h-3.5" />
            Admin Backoffice
          </button>

          <button
            id="demo-dealer-approved"
            type="button"
            onClick={() => triggerQuickLogin('dealer.approved@crystalfurnitech.com', 'dealer123')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#09090b]/50 hover:bg-[#fafafa] hover:text-[#09090b] text-[#fafafa] rounded-lg border border-[#27272a] font-medium transition duration-200"
          >
            <CheckCircle className="w-3.5 h-3.5 text-[#10b981]" />
            Approved Dealer
          </button>

          <button
            id="demo-dealer-pending"
            type="button"
            onClick={() => triggerQuickLogin('dealer.pending@crystalfurnitech.com', 'dealer123')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#09090b]/50 hover:bg-[#fafafa] hover:text-[#09090b] text-[#fafafa] rounded-lg border border-[#27272a] font-medium transition duration-200"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b]" />
            Pending Dealer
          </button>

          <button
            id="demo-dealer-rejected"
            type="button"
            onClick={() => triggerQuickLogin('dealer.rejected@crystalfurnitech.com', 'dealer123')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#09090b]/50 hover:bg-[#fafafa] hover:text-[#09090b] text-[#fafafa] rounded-lg border border-[#27272a] font-medium transition duration-200"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-[#ef4444]" />
            Rejected Dealer
          </button>

        </div>
      </div>
    </div>
  );
}

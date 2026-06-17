import React, { useState } from 'react';
import { DBService } from '../firebase';
import { DealerProfile } from '../types';
import BrandLogo from './BrandLogo';
import { Mail, Lock, LogIn, AlertTriangle, AlertOctagon } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: DealerProfile) => void;
  onGoToRegister: () => void;
  firebaseConnected?: boolean;
  networkChecked?: boolean;
  onRecheckConnection?: () => Promise<boolean>;
}

export default function Login({
  onLoginSuccess,
  onGoToRegister,
  firebaseConnected = false,
  networkChecked = false,
}: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'pending' | 'rejected' | 'suspended';
    message: string;
    details?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await DBService.login(email, password);
      if (user.role === 'dealer') {
        if (user.status === 'Pending Approval') {
          setStatusMessage({ type: 'pending', message: 'Your account is under verification.', details: 'Please wait for approval from Crystal Furnitech.' });
          return;
        }
        if (user.status === 'Rejected') {
          setStatusMessage({ type: 'rejected', message: 'Account not approved.', details: user.rejectionReason || 'Contact support@crystalfurnitech.com.' });
          return;
        }
        if (user.status === 'Suspended') {
          setStatusMessage({ type: 'suspended', message: 'Account suspended.', details: user.suspensionReason || 'Contact sales support.' });
          return;
        }
      }
      onLoginSuccess(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-5">
      <div className="text-center space-y-3">
        <BrandLogo variant="light" size="lg" subtitle="B2B Dealer Portal" className="justify-center" />
        <p className="text-sm text-neutral-400">Sign in to access your wholesale dashboard</p>
      </div>

      <div className="bg-[#222222] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#b65200] via-[#d4af37] to-[#b65200]" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500">Firebase</span>
            {!networkChecked ? (
              <span className="text-neutral-400 animate-pulse">Checking...</span>
            ) : (
              <span className={firebaseConnected ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                {firebaseConnected ? 'Connected' : 'Unreachable'}
              </span>
            )}
          </div>

          {statusMessage && (
            <div className={`p-3 rounded-lg border text-xs flex gap-2 ${
              statusMessage.type === 'pending' ? 'bg-[#b65200]/15 border-[#d4af37]/30 text-[#d4af37]' :
              statusMessage.type === 'rejected' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
              'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {statusMessage.type === 'pending' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <AlertOctagon className="w-4 h-4 shrink-0" />}
              <div>
                <p className="font-semibold">{statusMessage.message}</p>
                <p className="opacity-80 mt-0.5">{statusMessage.details}</p>
              </div>
            </div>
          )}

          {error && (
            <div id="login-error" className="bg-red-500/10 text-red-400 text-xs font-medium py-3 px-4 rounded-lg border border-red-500/30">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#d4af37]">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input id="login-email" type="email" required placeholder="name@business.com" value={email} onChange={(e) => setEmail(e.target.value)} className="cf-input w-full pl-9 pr-4 py-2.5 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#d4af37]">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input id="login-password" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="cf-input w-full pl-9 pr-4 py-2.5 text-sm" />
              </div>
            </div>
            <button id="btn-login-submit" type="submit" disabled={loading} className="w-full cf-btn-brand py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LogIn className="w-4 h-4" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-neutral-500">
            New dealer?{' '}
            <button id="btn-p-reg" type="button" onClick={onGoToRegister} className="text-[#d4af37] font-bold hover:underline cursor-pointer">
              Register here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

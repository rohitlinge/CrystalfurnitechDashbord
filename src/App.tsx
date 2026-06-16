import React, { useState, useEffect, useCallback } from 'react';
import { DBService, ensureFirebaseConnection, auth, waitForAuthReady, getFirebaseSetupHint } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { DealerProfile } from './types';
import Login from './components/Login';
import Register from './components/Register';
import AdminDashboard from './components/AdminDashboard';
import DealerDashboard from './components/DealerDashboard';
import { Server } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<DealerProfile | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register' | 'admin' | 'dealer'>('login');
  const [networkChecked, setNetworkChecked] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState(false);

  const recheckFirebaseConnection = useCallback(async () => {
    const connected = await ensureFirebaseConnection(20000);
    setFirebaseConnected(connected);
    setNetworkChecked(true);
    if (connected) {
      setNetworkError(null);
    } else {
      const hint = await getFirebaseSetupHint();
      setNetworkError(hint || 'Could not reach Firebase. Check your connection.');
    }
    return connected;
  }, []);

  useEffect(() => {
    recheckFirebaseConnection();
  }, [recheckFirebaseConnection]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    waitForAuthReady().then(() => {
      const stored = DBService.getActiveUser();
      if (stored) {
        setCurrentUser(stored);
        setCurrentScreen(stored.role === 'admin' ? 'admin' : 'dealer');
      } else {
        setCurrentScreen('login');
      }
      unsub = onAuthStateChanged(auth, (firebaseUser) => {
        const active = DBService.getActiveUser();
        if (!active) {
          if (!firebaseUser) setCurrentScreen('login');
          return;
        }
        if (!firebaseUser) {
          DBService.logout();
          setCurrentUser(null);
          setCurrentScreen('login');
          return;
        }
        const uidMatches = firebaseUser.uid === active.uid;
        const adminEmailMatch = active.role === 'admin' && firebaseUser.email === active.email;
        if (!uidMatches && !adminEmailMatch) {
          DBService.logout();
          setCurrentUser(null);
          setCurrentScreen('login');
        }
      });
    });
    return () => unsub?.();
  }, []);

  const handleLoginSuccess = (user: DealerProfile) => {
    setCurrentUser(user);
    setCurrentScreen(user.role === 'admin' ? 'admin' : 'dealer');
  };

  const handleLogout = () => {
    DBService.logout();
    setCurrentUser(null);
    setCurrentScreen('login');
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col antialiased">
      {networkError && (
        <div className="bg-[#b65200] text-white text-center py-2.5 px-4 font-semibold text-xs flex items-center justify-between gap-2 relative z-50">
          <div className="flex items-center gap-2 mx-auto">
            <Server className="w-4 h-4 shrink-0 animate-pulse" />
            <span>{networkError}</span>
          </div>
          <button type="button" onClick={() => recheckFirebaseConnection()} className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded text-[10px] uppercase font-bold shrink-0">
            Retry
          </button>
          <button type="button" onClick={() => setNetworkError(null)} className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded text-[10px] uppercase font-bold shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {currentScreen === 'login' && (
        <div className="grow flex flex-col items-center justify-center p-4 py-12 bg-neutral-50">
          <Login
            onLoginSuccess={handleLoginSuccess}
            onGoToRegister={() => setCurrentScreen('register')}
            firebaseConnected={firebaseConnected}
            networkChecked={networkChecked}
            onRecheckConnection={recheckFirebaseConnection}
          />
        </div>
      )}

      {currentScreen === 'register' && (
        <div className="grow flex flex-col items-center justify-center p-4 py-8 bg-neutral-50">
          <Register onBackToLogin={() => setCurrentScreen('login')} />
        </div>
      )}

      {currentScreen === 'admin' && currentUser && (
        <AdminDashboard adminUser={currentUser} onLogout={handleLogout} />
      )}

      {currentScreen === 'dealer' && currentUser && (
        <DealerDashboard dealerUser={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}

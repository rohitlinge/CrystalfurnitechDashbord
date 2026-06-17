import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { DBService, ensureFirebaseConnection, auth, waitForAuthReady, getFirebaseSetupHint } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { DealerProfile } from './types';
import Login from './components/Login';
import Toast, { ToastMessage } from './components/Toast';
import { Server } from 'lucide-react';

const Register = lazy(() => import('./components/Register'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const DealerDashboard = lazy(() => import('./components/DealerDashboard'));

function ScreenLoader() {
  return (
    <div className="grow flex items-center justify-center bg-[#0f0f0f]">
      <div className="w-8 h-8 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<DealerProfile | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register' | 'admin' | 'dealer'>('login');
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const recheckFirebaseConnection = useCallback(async () => {
    const connected = await ensureFirebaseConnection(20000);
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
    waitForAuthReady().then(async () => {
      const stored = DBService.getActiveUser();
      if (stored && auth.currentUser) {
        try {
          const fresh = await DBService.refreshUserProfile();
          if (fresh) {
            if (fresh.role === 'dealer' && fresh.status !== 'Approved') {
              DBService.logout();
              setCurrentUser(null);
              setCurrentScreen('login');
              setToast({ id: Date.now(), type: 'info', message: 'Your account is no longer approved. Please contact Crystal Furnitech.' });
            } else {
              setCurrentUser(fresh);
              setCurrentScreen(fresh.role === 'admin' ? 'admin' : 'dealer');
            }
          } else {
            DBService.logout();
            setCurrentScreen('login');
          }
        } catch {
          DBService.logout();
          setCurrentScreen('login');
        }
      } else if (stored && !auth.currentUser) {
        DBService.logout();
        setCurrentScreen('login');
      } else {
        setCurrentScreen('login');
      }
      setBooting(false);

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

  if (booting) {
    return <ScreenLoader />;
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col antialiased">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

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
        <div className="grow flex flex-col items-center justify-center p-4 py-12 bg-[#0f0f0f]">
          <Login
            onLoginSuccess={handleLoginSuccess}
            onGoToRegister={() => setCurrentScreen('register')}
          />
        </div>
      )}

      {currentScreen === 'register' && (
        <Suspense fallback={<ScreenLoader />}>
          <div className="grow flex flex-col items-center justify-center p-4 py-8 bg-[#0f0f0f]">
            <Register onBackToLogin={() => setCurrentScreen('login')} />
          </div>
        </Suspense>
      )}

      {currentScreen === 'admin' && currentUser && (
        <Suspense fallback={<ScreenLoader />}>
          <AdminDashboard adminUser={currentUser} onLogout={handleLogout} />
        </Suspense>
      )}

      {currentScreen === 'dealer' && currentUser && (
        <Suspense fallback={<ScreenLoader />}>
          <DealerDashboard dealerUser={currentUser} onLogout={handleLogout} />
        </Suspense>
      )}
    </div>
  );
}

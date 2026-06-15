import React, { useState, useEffect, useCallback } from 'react';
import { DBService, ensureFirebaseConnection, auth, waitForAuthReady, getFirebaseSetupHint } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { DealerProfile } from './types';
import Login from './components/Login';
import Register from './components/Register';
import AdminDashboard from './components/AdminDashboard';
import DealerDashboard from './components/DealerDashboard';
import { ShieldCheck, Server, Sparkles, Building } from 'lucide-react';

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
      setNetworkError(
        hint ||
          "Could not reach Firebase Cloud Firestore. Click Retry or check your internet connection."
      );
    }
    return connected;
  }, []);

  useEffect(() => {
    recheckFirebaseConnection();
  }, [recheckFirebaseConnection]);

  // Restore session after Firebase Auth finishes initializing (avoids false logouts)
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
    if (user.role === 'admin') {
      setCurrentScreen('admin');
    } else {
      setCurrentScreen('dealer');
    }
  };

  const handleLogout = () => {
    DBService.logout();
    setCurrentUser(null);
    setCurrentScreen('login');
  };

  // Render active layout views based on state routing
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col antialiased">
      
      {/* Real-time Alerts / Errors banner for connection issues if any */}
      {networkError && (
        <div className="bg-amber-600/90 text-white text-center py-2.5 px-4 font-semibold text-xs flex items-center justify-between gap-2 relative z-50 animate-fade-in">
          <div className="flex items-center gap-2 mx-auto">
            <Server className="w-4 h-4 text-white shrink-0 animate-pulse" />
            <span>{networkError}</span>
          </div>
          <button
            type="button"
            onClick={() => recheckFirebaseConnection()}
            className="p-1 px-2.5 bg-white/20 hover:bg-white/35 text-white text-[10px] uppercase font-bold rounded-md transition duration-200 cursor-pointer shrink-0"
            title="Retry Firebase connection"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => setNetworkError(null)}
            className="p-1 px-2.5 bg-white/20 hover:bg-white/35 text-white text-[10px] uppercase font-bold rounded-md transition duration-200 cursor-pointer text-right shrink-0"
            title="Dismiss notification"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Primary Layout Router */}
      {currentScreen === 'login' && (
        <div className="grow flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden bg-[#09090b]">
          
          {/* Accent decoration vector rings */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-zinc-800/10 rounded-full blur-3xl opacity-60 -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-zinc-900/40 rounded-full blur-3xl opacity-40 -ml-20 -mb-20"></div>

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
        <div className="grow flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden bg-[#09090b]">
          
          {/* Accent decoration vector rings */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-zinc-800/20 rounded-full blur-3xl opacity-60 -mr-40 -mt-20"></div>

          <Register 
            onBackToLogin={() => setCurrentScreen('login')}
          />
        </div>
      )}

      {currentScreen === 'admin' && currentUser && (
        <AdminDashboard 
          adminUser={currentUser}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === 'dealer' && currentUser && (
        <DealerDashboard 
          dealerUser={currentUser}
          onLogout={handleLogout}
        />
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { DBService, db } from './firebase';
import { DealerProfile } from './types';
import Login from './components/Login';
import Register from './components/Register';
import AdminDashboard from './components/AdminDashboard';
import DealerDashboard from './components/DealerDashboard';
import { doc, getDocFromServer } from 'firebase/firestore';
import { ShieldCheck, Server, Sparkles, Building } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<DealerProfile | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register' | 'admin' | 'dealer'>('login');
  const [networkChecked, setNetworkChecked] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Connection testing of Firestore client as commanded by firebase-integration skill guidelines
  useEffect(() => {
    async function testConnection() {
      try {
        // Skip calling firestore server if in local mock mode
        if (DBService.isMockMode()) {
          setNetworkChecked(true);
          return;
        }
        // Test connection with a safe fast-timeout race
        await Promise.race([
          getDocFromServer(doc(db, 'test', 'connection')),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
        ]);
        console.log("Firestore connection check successful.");
      } catch (error: any) {
        const errorMsg = error?.message || '';
        console.error("Firestore connection health check result:", error);
        if (errorMsg.includes('the client is offline') || errorMsg === 'timeout' || errorMsg.includes('failed-precondition') || errorMsg.includes('unavailable')) {
          console.warn("Client connection verification offline status:", errorMsg);
          setNetworkError("Live sync with Google Cloud is pending. Please verify your connection.");
        }
      } finally {
        setNetworkChecked(true);
      }
    }
    testConnection();
  }, []);

  // Initialize auth state from local persisted cached session on initial load
  useEffect(() => {
    const active = DBService.getActiveUser();
    if (active) {
      setCurrentUser(active);
      if (active.role === 'admin') {
        setCurrentScreen('admin');
      } else {
        setCurrentScreen('dealer');
      }
    } else {
      setCurrentScreen('login');
    }
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
            <span>{networkError} - Local sandbox overrides active.</span>
          </div>
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

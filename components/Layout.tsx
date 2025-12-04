import React from 'react';
import { User, UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  onNavigate: (page: string) => void;
  currentPage: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onNavigate, currentPage }) => {
  return (
    <div className="min-h-screen bg-dark-950 text-slate-200 font-sans flex flex-col md:flex-row">
      {/* Sidebar / Mobile Nav */}
      {user && (
        <aside className="w-full md:w-64 bg-dark-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between shrink-0 sticky top-0 z-50">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-brand-500 tracking-tight flex items-center gap-2">
              <span className="text-3xl">♟</span> GM Chess
            </h1>
            <div className="mt-6 flex flex-col gap-2">
              <NavButton active={currentPage === 'lobby'} onClick={() => onNavigate('lobby')} icon="🎮">Play Arena</NavButton>
              <NavButton active={currentPage === 'wallet'} onClick={() => onNavigate('wallet')} icon="💰">Wallet</NavButton>
              {user.role === UserRole.ADMIN && (
                <NavButton active={currentPage === 'admin'} onClick={() => onNavigate('admin')} icon="⚡">Admin Panel</NavButton>
              )}
            </div>
          </div>
          
          <div className="p-6 bg-dark-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-brand-900 flex items-center justify-center text-brand-400 font-bold">
                {user.email[0].toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user.email}</p>
                <p className="text-xs text-brand-400 font-mono">${user.balance.toFixed(2)} USDT</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="w-full text-sm py-2 px-4 rounded border border-slate-700 hover:bg-slate-800 transition-colors text-slate-400"
            >
              Sign Out
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; icon: string }> = ({ active, onClick, children, icon }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${
      active 
        ? 'bg-brand-900/50 text-brand-400 border border-brand-800/50' 
        : 'hover:bg-dark-800 text-slate-400'
    }`}
  >
    <span className="text-xl">{icon}</span>
    <span className="font-medium">{children}</span>
  </button>
);
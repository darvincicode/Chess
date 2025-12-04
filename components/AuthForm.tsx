import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { store, saveSupabaseConfig, getSupabaseConfig } from '../services/store';

interface AuthFormProps {
  onLogin: (user: User) => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const sbConfig = getSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(sbConfig.url);
  const [sbKey, setSbKey] = useState(sbConfig.key);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // FIX: Supabase requires a valid email format. 
    // If user types 'admin', we treat it as 'admin@gmchess.com'
    let submitEmail = email.trim();
    if (!submitEmail.includes('@')) {
        submitEmail = `${submitEmail}@gmchess.com`;
    }

    try {
        if (isLogin) {
            const user = await store.login(submitEmail, password);
            if (user) {
                onLogin(user);
            } else {
                // This branch is rarely reached now as errors throw
                alert("Login failed. If this is your first time, please switch to 'Sign Up'.");
            }
        } else {
            // Check if user exists (logic inside store)
            const user = await store.createUser(submitEmail, password, isAdminMode ? UserRole.ADMIN : UserRole.USER);
            if (user) {
                alert("Account created successfully! Please check your email inbox to confirm your address before logging in.");
                setIsLogin(true); // Switch to login view
            }
        }
    } catch (e: any) {
        console.error(e);
        // SPECIFIC ERROR HANDLING
        if (e.message && e.message.includes("Email not confirmed")) {
             alert("⚠️ EMAIL NOT VERIFIED\n\nPlease check your inbox (and spam folder) for the confirmation link from Supabase to activate your account.");
        } else if (e.message && e.message.includes("Invalid login credentials")) {
             alert("Invalid email or password. Please try again.");
        } else {
             alert("Authentication Error: " + (e.message || "Unknown error"));
        }
    } finally {
        setLoading(false);
    }
  };

  const handleAdminFill = () => {
    // FIX: Pre-fill with the email format compatible with Supabase
    setEmail('admin@gmchess.com');
    setPassword('123456');
    setIsLogin(true); // Default to login, but user might need to switch to Sign Up if first time
  };

  const handleSaveConfig = () => {
      saveSupabaseConfig(sbUrl, sbKey);
  };

  if (showSettings) {
      return (
        <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
             <div className="bg-dark-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
                <h2 className="text-xl font-bold mb-4">Supabase Configuration</h2>
                <p className="text-xs text-slate-400 mb-4">Enter your Supabase URL and Anon Key to enable the persistent database. Clear them to use local mock mode.</p>
                <div className="space-y-4">
                    <div>
                        <label className="text-slate-500 text-xs font-bold">Supabase URL</label>
                        <input value={sbUrl} onChange={e => setSbUrl(e.target.value)} className="w-full bg-dark-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                    <div>
                        <label className="text-slate-500 text-xs font-bold">Supabase Anon Key</label>
                        <input value={sbKey} onChange={e => setSbKey(e.target.value)} className="w-full bg-dark-950 border border-slate-700 rounded p-2 text-white" />
                    </div>
                    <button onClick={handleSaveConfig} className="w-full bg-brand-600 text-white py-2 rounded font-bold">Save & Reload</button>
                    <button onClick={() => setShowSettings(false)} className="w-full text-slate-400 py-2">Cancel</button>
                </div>
             </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
        <button onClick={() => setShowSettings(true)} className="absolute top-4 right-4 text-slate-600 hover:text-white">⚙️</button>
        <h1 className="text-3xl font-black text-brand-500 mb-2 text-center">GM Chess</h1>
        <p className="text-slate-400 text-center mb-8">
          {isLogin ? 'Sign in to continue' : 'Create your challenger account'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Username / Email</label>
            <input 
              required
              type="text" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-dark-950 border border-slate-700 rounded-lg p-3 text-white mt-1 focus:border-brand-500 outline-none"
              placeholder="Enter email or 'admin'"
            />
          </div>
          <div>
            <label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Password</label>
            <input 
              required
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-dark-950 border border-slate-700 rounded-lg p-3 text-white mt-1 focus:border-brand-500 outline-none"
              placeholder="••••••••"
            />
          </div>
          
          {!isLogin && (
            <div className="flex items-center gap-2">
               <input 
                 type="checkbox" 
                 checked={isAdminMode} 
                 onChange={e => setIsAdminMode(e.target.checked)} 
                 id="admin-check"
               />
               <label htmlFor="admin-check" className="text-slate-400 text-sm">Create as Admin (Demo)</label>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-lg shadow-lg shadow-brand-900/50 mt-4 transition-transform active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isLogin ? 'Enter Arena' : 'Create Account')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center space-y-4">
            <p className="text-slate-500 text-sm">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button 
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-brand-400 hover:underline font-bold"
                >
                    {isLogin ? 'Sign Up' : 'Log In'}
                </button>
            </p>

            <button 
                onClick={handleAdminFill}
                className="text-xs text-slate-600 hover:text-brand-500 transition-colors flex items-center justify-center gap-1 mx-auto"
            >
                <span>⚡</span> Admin Panel Access
            </button>
            
            {/* Helper text for the format fix */}
            <p className="text-[10px] text-slate-700">
               Note: 'admin' will be treated as 'admin@gmchess.com'
            </p>
        </div>
      </div>
    </div>
  );
};
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { store } from '../services/store';

interface AuthFormProps {
  onLogin: (user: User) => void;
}

export const AuthForm: React.FC<AuthFormProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false); // For demo purposes

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      const user = store.login(email, password);
      if (user) {
        onLogin(user);
      } else {
        alert("Invalid credentials or banned.");
      }
    } else {
      // Check if user exists
      const existing = store.getUsers().find(u => u.email === email);
      if (existing) {
        alert("User already exists");
        return;
      }
      const user = store.createUser(email, password, isAdminMode ? UserRole.ADMIN : UserRole.USER);
      onLogin(user);
    }
  };

  const handleAdminFill = () => {
    setEmail('admin');
    setPassword('123456');
    setIsLogin(true);
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
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
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-lg shadow-lg shadow-brand-900/50 mt-4 transition-transform active:scale-95"
          >
            {isLogin ? 'Enter Arena' : 'Create Account'}
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

            {/* Admin Panel Access Link */}
            <button 
                onClick={handleAdminFill}
                className="text-xs text-slate-600 hover:text-brand-500 transition-colors flex items-center justify-center gap-1 mx-auto"
            >
                <span>⚡</span> Admin Panel Access
            </button>
        </div>
      </div>
    </div>
  );
};
import React, { useState } from 'react';
import { User, Transaction, AdminSettings } from '../types';
import { store } from '../services/store';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface AdminPanelProps {
  users: User[];
  transactions: Transaction[];
  settings: AdminSettings;
  onUpdateSettings: (s: AdminSettings) => void;
  onProcessTx: (id: string, approve: boolean) => void;
  onBanUser: (id: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  users, transactions, settings, onUpdateSettings, onProcessTx, onBanUser 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'finance' | 'settings'>('overview');
  const [editSettings, setEditSettings] = useState<AdminSettings>(settings);
  
  // User Edit State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ email: '', password: '', balance: 0 });

  // Admin Profile State
  const [adminPass, setAdminPass] = useState('');

  // Stats
  const totalDeposits = transactions
    .filter(t => t.type === 'DEPOSIT' && t.status === 'COMPLETED')
    .reduce((acc, curr) => acc + curr.amount, 0);
  
  const totalUsers = users.length;
  const pendingTx = transactions.filter(t => t.status === 'PENDING');

  const chartData = [
    { name: 'Deposits', amount: totalDeposits },
    { name: 'Withdraws', amount: transactions.filter(t => t.type === 'WITHDRAW' && t.status === 'COMPLETED').reduce((a,c) => a+c.amount,0) },
  ];

  const handleSaveSettings = () => {
    onUpdateSettings(editSettings);
    // Also save admin password if changed
    if (adminPass) {
        const admin = store.getCurrentUser();
        if (admin && admin.role === 'ADMIN') {
            store.updateUser(admin.id, { password: adminPass });
            alert("Settings & Admin Password Saved");
        }
    } else {
        alert("Settings Saved");
    }
    setAdminPass('');
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({ email: user.email, password: user.password || '', balance: user.balance });
  };

  const saveUserEdit = () => {
    if (editingUser) {
        store.updateUser(editingUser.id, {
            email: editForm.email,
            password: editForm.password,
            balance: editForm.balance
        });
        setEditingUser(null);
        // Force refresh via parent update usually, but local state might lag until refreshUserData called. 
        // We rely on parent passing fresh users prop or we trigger a refresh somehow. 
        // Ideally App should pass a refresher or we accept that stats update on next tick.
        alert("User Updated");
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white mb-6">Admin Command Center</h2>
      
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-1 mb-6 overflow-x-auto">
        {['overview', 'users', 'finance', 'settings'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 capitalize font-medium ${activeTab === tab ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-400 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Users" value={totalUsers.toString()} icon="👥" />
          <StatCard title="Total Deposits" value={`$${totalDeposits.toFixed(2)}`} icon="💵" />
          <StatCard title="Pending Txns" value={pendingTx.length.toString()} icon="⏳" highlight={pendingTx.length > 0} />
          
          <div className="col-span-1 md:col-span-2 bg-dark-800 p-4 rounded-lg border border-slate-700 h-64">
            <h3 className="text-slate-400 mb-4 text-sm font-bold uppercase tracking-wider">Financial Overview</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff' }}
                    cursor={{fill: '#334155', opacity: 0.2}}
                />
                <Bar dataKey="amount" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-dark-800 rounded-lg overflow-hidden border border-slate-700">
          {editingUser ? (
             <div className="p-6 space-y-4">
                <h3 className="text-lg font-bold">Edit User: {editingUser.email}</h3>
                <InputGroup label="Email / Username" value={editForm.email} onChange={v => setEditForm({...editForm, email: v})} />
                <InputGroup label="Password" value={editForm.password} onChange={v => setEditForm({...editForm, password: v})} />
                <InputGroup label="Balance (USDT)" type="number" value={editForm.balance} onChange={v => setEditForm({...editForm, balance: Number(v)})} />
                
                <div className="flex gap-4 mt-4">
                    <button onClick={saveUserEdit} className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-500">Save Changes</button>
                    <button onClick={() => setEditingUser(null)} className="px-4 py-2 bg-dark-700 text-white rounded hover:bg-dark-600">Cancel</button>
                </div>
             </div>
          ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-dark-900 text-slate-200 font-mono uppercase">
                    <tr>
                        <th className="p-4">Email</th>
                        <th className="p-4">Balance</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Pass</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Action</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                    {users.map(u => (
                        <tr key={u.id} className="hover:bg-dark-700/50">
                        <td className="p-4">{u.email}</td>
                        <td className="p-4 text-brand-400 font-mono">${u.balance.toFixed(2)}</td>
                        <td className="p-4">{u.role}</td>
                        <td className="p-4 font-mono">****</td>
                        <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs ${u.isBanned ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
                            {u.isBanned ? 'BANNED' : 'ACTIVE'}
                            </span>
                        </td>
                        <td className="p-4 flex gap-2">
                            <button onClick={() => startEditUser(u)} className="text-brand-400 hover:text-brand-300">Edit</button>
                            {u.role !== 'ADMIN' && (
                                <button 
                                    onClick={() => onBanUser(u.id)}
                                    className="text-red-400 hover:text-red-300"
                                >
                                    {u.isBanned ? 'Unban' : 'Ban'}
                                </button>
                            )}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'finance' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Pending Approvals</h3>
          {pendingTx.length === 0 ? (
            <p className="text-slate-500 italic">No pending transactions.</p>
          ) : (
            <div className="grid gap-4">
              {pendingTx.map(tx => (
                <div key={tx.id} className="bg-dark-800 p-4 rounded border border-slate-700 flex justify-between items-center">
                  <div>
                    <span className={`text-xs font-bold px-2 py-1 rounded mr-2 ${tx.type === 'DEPOSIT' ? 'bg-brand-900 text-brand-400' : 'bg-orange-900 text-orange-400'}`}>
                        {tx.type}
                    </span>
                    <span className="font-mono text-white text-lg mr-2">${tx.amount}</span>
                    <span className="text-slate-500 text-sm">via {tx.network}</span>
                    <div className="text-xs text-slate-600 mt-1">{new Date(tx.timestamp).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onProcessTx(tx.id, true)} className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded text-sm">Approve</button>
                    <button onClick={() => onProcessTx(tx.id, false)} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-dark-800 p-6 rounded-lg border border-slate-700 max-w-2xl">
          <h3 className="text-xl mb-4 font-bold">Payment Configuration</h3>
          <div className="space-y-4">
            <InputGroup label="TRC20 Wallet Address" value={editSettings.walletTrc20} onChange={v => setEditSettings({...editSettings, walletTrc20: v})} />
            <InputGroup label="ERC20 Wallet Address" value={editSettings.walletErc20} onChange={v => setEditSettings({...editSettings, walletErc20: v})} />
            <InputGroup label="BEP20 Wallet Address" value={editSettings.walletBep20} onChange={v => setEditSettings({...editSettings, walletBep20: v})} />
            
            <div className="grid grid-cols-2 gap-4">
              <InputGroup type="number" label="Min Deposit ($)" value={editSettings.minDeposit} onChange={v => setEditSettings({...editSettings, minDeposit: Number(v)})} />
              <InputGroup type="number" label="Min Withdraw ($)" value={editSettings.minWithdraw} onChange={v => setEditSettings({...editSettings, minWithdraw: Number(v)})} />
            </div>

            <div className="pt-6 border-t border-slate-700">
                <h3 className="text-lg mb-4 font-bold text-brand-400">Admin Security</h3>
                <InputGroup 
                    type="password" 
                    label="Change Your Password" 
                    value={adminPass} 
                    onChange={v => setAdminPass(v)} 
                />
            </div>

            <button onClick={handleSaveSettings} className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 rounded font-bold mt-4">
              Save Configuration
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; icon: string; highlight?: boolean }> = ({ title, value, icon, highlight }) => (
  <div className={`p-4 rounded-lg border ${highlight ? 'bg-brand-900/20 border-brand-500' : 'bg-dark-800 border-slate-700'}`}>
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
      <span className="text-2xl">{icon}</span>
    </div>
  </div>
);

const InputGroup: React.FC<{ label: string; value: string | number; onChange: (v: string) => void; type?: string }> = ({ label, value, onChange, type = "text" }) => (
  <div>
    <label className="block text-slate-400 text-sm mb-1">{label}</label>
    <input 
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-dark-900 border border-slate-600 rounded p-2 text-white focus:border-brand-500 outline-none"
    />
  </div>
);
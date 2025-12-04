import React, { useState, useEffect } from 'react';
import { User, Network, Transaction } from '../types';
import { store } from '../services/store';

interface WalletProps {
  user: User;
  refreshData: () => Promise<void>;
}

export const Wallet: React.FC<WalletProps> = ({ user, refreshData }) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<number>(0);
  const [network, setNetwork] = useState<Network>(Network.TRC20);
  const [withdrawAddr, setWithdrawAddr] = useState('');
  const [error, setError] = useState('');
  
  const [settings, setSettings] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    store.getSettings().then(setSettings);
    store.getTransactions(user.id).then(txs => {
        setTransactions(txs.sort((a,b) => b.timestamp - a.timestamp));
    });
  }, [user.id]);

  const getDepositAddress = () => {
    if (!settings) return 'Loading...';
    switch (network) {
      case Network.TRC20: return settings.walletTrc20;
      case Network.ERC20: return settings.walletErc20;
      case Network.BEP20: return settings.walletBep20;
      default: return '';
    }
  };

  const handleTransaction = async () => {
    setError('');
    if (!settings) return;
    
    if (activeTab === 'deposit') {
      if (amount < settings.minDeposit) {
        setError(`Minimum deposit is $${settings.minDeposit}`);
        return;
      }
      // Create mock pending deposit
      await store.createTransaction({
        userId: user.id,
        type: 'DEPOSIT',
        amount: amount,
        network: network,
      });
      alert("Deposit request created. Admin will approve shortly.");
    } else {
      if (amount < settings.minWithdraw) {
        setError(`Minimum withdraw is $${settings.minWithdraw}`);
        return;
      }
      if (amount > user.balance) {
        setError("Insufficient funds.");
        return;
      }
      await store.createTransaction({
        userId: user.id,
        type: 'WITHDRAW',
        amount: amount,
        network: network,
        address: withdrawAddr,
      });
      alert("Withdraw request submitted.");
    }
    setAmount(0);
    
    // Refresh local lists
    const txs = await store.getTransactions(user.id);
    setTransactions(txs.sort((a,b) => b.timestamp - a.timestamp));
    refreshData();
  };

  if (!settings) return <div>Loading Wallet...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* Action Card */}
      <div className="bg-dark-800 border border-slate-700 rounded-2xl p-6 lg:p-8">
        <div className="flex gap-4 mb-8">
          <button 
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'deposit' ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50' : 'bg-dark-900 text-slate-400 hover:bg-dark-700'}`}
          >
            Deposit
          </button>
          <button 
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'withdraw' ? 'bg-red-600 text-white shadow-lg shadow-red-900/50' : 'bg-dark-900 text-slate-400 hover:bg-dark-700'}`}
          >
            Withdraw
          </button>
        </div>

        <div className="space-y-6">
          {activeTab === 'deposit' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
               <div className="text-center p-6 bg-white rounded-xl mx-auto w-fit">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${getDepositAddress()}`} 
                    alt="Wallet QR" 
                    className="w-48 h-48"
                  />
               </div>
               <p className="text-center text-xs text-slate-500 font-mono break-all bg-dark-950 p-3 rounded">
                 {getDepositAddress()}
               </p>
            </div>
          ) : (
             <div className="space-y-4 animate-in fade-in duration-300">
                <label className="block text-sm text-slate-400">Withdrawal Address</label>
                <input 
                  type="text" 
                  value={withdrawAddr}
                  onChange={(e) => setWithdrawAddr(e.target.value)}
                  placeholder="Enter your wallet address"
                  className="w-full bg-dark-950 border border-slate-700 rounded-lg p-3 focus:border-brand-500 outline-none font-mono"
                />
             </div>
          )}

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm text-slate-400 mb-2">Network</label>
                <select 
                  value={network} 
                  onChange={(e) => setNetwork(e.target.value as Network)}
                  className="w-full bg-dark-950 border border-slate-700 rounded-lg p-3 text-white outline-none"
                >
                  {Object.values(Network).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
             </div>
             <div>
                <label className="block text-sm text-slate-400 mb-2">Amount (USDT)</label>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-dark-950 border border-slate-700 rounded-lg p-3 text-white outline-none font-mono"
                />
             </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button 
            onClick={handleTransaction}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              activeTab === 'deposit' 
                ? 'bg-brand-600 hover:bg-brand-500 text-white' 
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
             {activeTab === 'deposit' ? 'I have sent payment' : 'Request Withdrawal'}
          </button>
        </div>
      </div>

      {/* History Card */}
      <div className="bg-dark-800 border border-slate-700 rounded-2xl p-6 lg:p-8 h-fit">
        <h3 className="text-xl font-bold mb-4">Transaction History</h3>
        <div className="space-y-3">
          {transactions.length === 0 && <p className="text-slate-500">No transactions yet.</p>}
          {transactions.map(tx => (
            <div key={tx.id} className="flex justify-between items-center p-3 bg-dark-900/50 rounded-lg border border-slate-800">
              <div className="flex items-center gap-3">
                 <div className={`p-2 rounded-full ${tx.type === 'DEPOSIT' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {tx.type === 'DEPOSIT' ? '↓' : '↑'}
                 </div>
                 <div>
                    <p className="font-bold text-sm">{tx.type}</p>
                    <p className="text-xs text-slate-500">{new Date(tx.timestamp).toLocaleDateString()}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="font-mono font-bold">${tx.amount}</p>
                 <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                   tx.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : 
                   tx.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                 }`}>
                   {tx.status}
                 </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
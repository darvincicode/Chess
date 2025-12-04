import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { AuthForm } from './components/AuthForm';
import { Board } from './components/Board';
import { Wallet } from './components/Wallet';
import { AdminPanel } from './components/AdminPanel';
import { User, GameSession, UserRole } from './types';
import { store } from './services/store';
import { STARTING_FEN, MATCHMAKING_TIMEOUT_MS } from './constants';

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<string>('lobby'); // lobby, game, wallet, admin, auth
  const [activeGame, setActiveGame] = useState<GameSession | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [wager, setWager] = useState(0.1);
  const [searchTimer, setSearchTimer] = useState(0);

  // Initialize
  useEffect(() => {
    store.init().then(() => {
        store.getCurrentUser().then(u => {
            setUser(u);
            setLoading(false);
        });
    });
  }, []);

  // Refresh data helper
  const refreshUserData = async () => {
    if (user) {
        // For local mock, getting current user is enough. For DB, we fetch fresh.
        const users = await store.getUsers();
        const updated = users.find(u => u.id === user.id);
        if (updated) setUser(updated);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isSearching) {
      interval = setInterval(() => {
        setSearchTimer(prev => prev + 1);
      }, 1000);
    } else {
      setSearchTimer(0);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

  // Matchmaking Logic
  useEffect(() => {
    if (isSearching && searchTimer > 60) {
      startBotGame();
    }
  }, [searchTimer, isSearching]);

  const startBotGame = async () => {
    if (!user) return;
    setIsSearching(false);
    
    const gameId = Math.random().toString(36).substr(2, 9);
    const newGame: GameSession = {
      id: gameId,
      whiteId: user.id,
      blackId: 'AI_BOT',
      wager: wager,
      fen: STARTING_FEN,
      turn: 'w',
      status: 'ACTIVE',
      history: [],
      isAiGame: true,
      lastMoveTimestamp: Date.now()
    };
    
    await store.updateBalance(user.id, -wager);
    await refreshUserData();
    
    setActiveGame(newGame);
    setPage('game');
  };

  const handleAuth = (u: User) => {
    setUser(u);
    setPage('lobby');
  };

  const handleLogout = async () => {
    await store.logout();
    setUser(null);
    setPage('auth');
  };

  const handleMove = (moveSan: string, newFen: string) => {
    if (!activeGame || !user) return;

    const nextTurn = activeGame.turn === 'w' ? 'b' : 'w';
    
    const updatedGame: GameSession = {
      ...activeGame,
      fen: newFen,
      turn: nextTurn,
      history: [...activeGame.history, moveSan],
      lastMoveTimestamp: Date.now()
    };
    setActiveGame(updatedGame);
  };

  const handleGameOver = async (winnerColor: string | null) => {
    if (!activeGame || !user) return;
    
    let winnerId: string | null = null;
    if (winnerColor === 'white') winnerId = activeGame.whiteId;
    if (winnerColor === 'black') winnerId = activeGame.blackId;

    const updatedGame = { ...activeGame, status: 'COMPLETED' as const, winnerId };
    setActiveGame(updatedGame);

    if (winnerId === user.id) {
        await store.updateBalance(user.id, activeGame.wager * 2);
        alert("You Won! Prize credited.");
    } else if (winnerId === 'AI_BOT') {
        alert("You Lost! Wager lost.");
    } else {
        await store.updateBalance(user.id, activeGame.wager);
        alert("Draw! Wager returned.");
    }
    await refreshUserData();
  };

  if (loading) {
      return <div className="min-h-screen bg-dark-950 flex items-center justify-center text-brand-500">Loading...</div>;
  }

  if (!user) {
    return <AuthForm onLogin={handleAuth} />;
  }

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout} 
      onNavigate={setPage}
      currentPage={page}
    >
      {page === 'lobby' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in zoom-in-95 duration-500">
          <div className="space-y-2">
            <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-emerald-600">
              ARENA
            </h2>
            <p className="text-slate-400">Find a worthy opponent or face the Grandmaster AI.</p>
          </div>

          <div className="bg-dark-800 p-8 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
             {!isSearching ? (
               <>
                 <div className="mb-6">
                    <label className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2 block">Wager Amount (USDT)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input 
                        type="number" 
                        min="0.1" 
                        step="0.1"
                        value={wager}
                        onChange={(e) => setWager(Number(e.target.value))}
                        className="w-full bg-dark-950 border border-slate-600 rounded-xl p-4 pl-8 text-2xl font-mono text-white focus:border-brand-500 outline-none"
                      />
                    </div>
                    {wager > user.balance && <p className="text-red-500 text-sm mt-2">Insufficient balance</p>}
                 </div>
                 
                 <button 
                   disabled={wager > user.balance}
                   onClick={() => setIsSearching(true)}
                   className="w-full py-4 bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white font-bold rounded-xl text-lg shadow-lg shadow-brand-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
                 >
                   Find Match
                 </button>
               </>
             ) : (
               <div className="py-8">
                 <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                 <h3 className="text-xl font-bold text-white mb-2">Searching for Opponent...</h3>
                 <p className="text-brand-400 font-mono text-lg">{searchTimer}s</p>
                 <p className="text-slate-500 text-xs mt-4">If no player is found in 60s, a Gemini AI Bot will accept the challenge.</p>
                 <button 
                   onClick={() => setIsSearching(false)}
                   className="mt-6 text-red-400 hover:text-red-300 underline text-sm"
                 >
                   Cancel Search
                 </button>
               </div>
             )}
          </div>
        </div>
      )}

      {page === 'game' && activeGame && (
        <div className="flex flex-col items-center animate-in fade-in duration-500">
           <button onClick={() => { setActiveGame(null); setPage('lobby'); }} className="self-start mb-4 text-slate-400 hover:text-white">← Back to Lobby</button>
           <Board 
             game={activeGame} 
             currentUser={user} 
             onMove={handleMove}
             onGameOver={handleGameOver}
           />
        </div>
      )}

      {page === 'wallet' && (
        <Wallet user={user} refreshData={refreshUserData} />
      )}

      {page === 'admin' && user.role === UserRole.ADMIN && (
        <AdminPanel 
          user={user}
          refreshData={refreshUserData}
        />
      )}
    </Layout>
  );
};

export default App;
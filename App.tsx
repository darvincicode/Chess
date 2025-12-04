import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { AuthForm } from './components/AuthForm';
import { Board } from './components/Board';
import { Wallet } from './components/Wallet';
import { AdminPanel } from './components/AdminPanel';
import { User, GameSession, UserRole } from './types';
import { store } from './services/store';
import { STARTING_FEN, MATCHMAKING_TIMEOUT_MS, TIME_CONTROLS } from './constants';

const BOT_NAMES = [
  "ChessViking99", "GrandRook_X", "PawnStormer", "TacticsTom", 
  "BishopBlade", "KnightRider", "QueenSlayer", "DeepThinker", 
  "OpeningOliver", "EndgameEvan", "CheckMateKing", "GambitGuru"
];

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<string>('lobby'); // lobby, game, wallet, admin, auth
  const [activeGame, setActiveGame] = useState<GameSession | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [wager, setWager] = useState(0.1);
  const [selectedTime, setSelectedTime] = useState(10); // Default 10 min
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
    // Convert ms to seconds for comparison
    const timeoutSeconds = MATCHMAKING_TIMEOUT_MS / 1000;
    if (isSearching && searchTimer >= timeoutSeconds) {
      startBotGame();
    }
  }, [searchTimer, isSearching]);

  const startBotGame = async () => {
    if (!user) return;
    setIsSearching(false);
    
    // Pick a random human-like name
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const timeInMs = selectedTime * 60 * 1000;

    // Randomize sides (50/50 chance to be White or Black)
    const userIsWhite = Math.random() > 0.5;
    const whiteId = userIsWhite ? user.id : botName;
    const blackId = userIsWhite ? botName : user.id;

    const gameId = Math.random().toString(36).substr(2, 9);
    const newGame: GameSession = {
      id: gameId,
      whiteId: whiteId,
      blackId: blackId, 
      wager: wager,
      fen: STARTING_FEN,
      turn: 'w',
      status: 'ACTIVE',
      history: [],
      isAiGame: true,
      lastMoveTimestamp: Date.now(),
      timeControlMinutes: selectedTime,
      whiteTimeRemaining: timeInMs,
      blackTimeRemaining: timeInMs
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

  const handleMove = (moveSan: string, newFen: string, wTime: number, bTime: number) => {
    if (!activeGame || !user) return;

    // Calculate next turn based on current active turn in game state
    const nextTurn = activeGame.turn === 'w' ? 'b' : 'w';
    
    const updatedGame: GameSession = {
      ...activeGame,
      fen: newFen,
      turn: nextTurn,
      history: [...activeGame.history, moveSan],
      lastMoveTimestamp: Date.now(),
      whiteTimeRemaining: wTime,
      blackTimeRemaining: bTime
    };
    setActiveGame(updatedGame);
  };

  const handleGameOver = async (winnerColor: string | null, method?: string) => {
    if (!activeGame || !user) return;
    
    let winnerId: string | null = null;
    if (winnerColor === 'white') winnerId = activeGame.whiteId;
    if (winnerColor === 'black') winnerId = activeGame.blackId;

    const updatedGame = { ...activeGame, status: 'COMPLETED' as const, winnerId };
    setActiveGame(updatedGame);

    const resultMethod = method ? ` (${method})` : '';

    // HOUSE MONEY LOGIC
    // We assume there is an ADMIN account that acts as the "House".
    // 1. Fetch all users to find admin.
    const users = await store.getUsers();
    // Use the first admin found as the House wallet
    const admin = users.find(u => u.role === UserRole.ADMIN);

    if (winnerId === user.id) {
        // PLAYER WINS
        // Return original wager + matching amount from House
        await store.updateBalance(user.id, activeGame.wager * 2);
        
        if (activeGame.isAiGame && admin) {
            // Deduct the matching amount from Admin (User wager was already deducted at start)
            // Wait: User paid 1. Admin pays 1. User gets 2.
            // Admin balance should decrease by wager amount.
            await store.updateBalance(admin.id, -activeGame.wager);
        }

        alert(`You Won${resultMethod}! Prize credited.`);
    } else if (activeGame.isAiGame && winnerId !== user.id && winnerId !== null) {
        // BOT WINS (PLAYER LOSS)
        // User wager was deducted at start. 
        // We credit that wager to the Admin wallet.
        if (admin) {
            await store.updateBalance(admin.id, activeGame.wager);
        }
        alert(`You Lost${resultMethod}! Wager lost.`);
    } else if (!winnerId) {
        // DRAW
        // Return wager to user.
        await store.updateBalance(user.id, activeGame.wager);
        alert(`Draw${resultMethod}! Wager returned.`);
    } else {
        // PvP Human Game Over (Logic remains simple for now, just winner takes all?)
        // Currently PvP not fully implemented in matchmaker, but logic handles it genericly.
        alert("Game Over.");
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
               <div className="space-y-6">
                 {/* Wager Input */}
                 <div>
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

                 {/* Time Control Selector */}
                 <div>
                    <label className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2 block">Game Time</label>
                    <div className="grid grid-cols-2 gap-2">
                        <select 
                            value={selectedTime}
                            onChange={(e) => setSelectedTime(Number(e.target.value))}
                            className="w-full col-span-2 bg-dark-950 border border-slate-600 rounded-xl p-3 text-white focus:border-brand-500 outline-none appearance-none"
                        >
                            {TIME_CONTROLS.map(tc => (
                                <option key={tc.value} value={tc.value}>{tc.label}</option>
                            ))}
                        </select>
                    </div>
                 </div>
                 
                 <button 
                   disabled={wager > user.balance}
                   onClick={() => setIsSearching(true)}
                   className="w-full py-4 bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white font-bold rounded-xl text-lg shadow-lg shadow-brand-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
                 >
                   Find Match
                 </button>
               </div>
             ) : (
               <div className="py-8">
                 <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                 <h3 className="text-xl font-bold text-white mb-2">Searching for Opponent...</h3>
                 <p className="text-brand-400 font-mono text-lg">{searchTimer}s / 30s</p>
                 <p className="text-slate-500 text-xs mt-4">Bot will auto-join if no player found in 30s.</p>
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
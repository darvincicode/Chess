import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess, Move } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { GameSession, User } from '../types';
import { GEMINI_MODEL_ID, AI_THINKING_TIME_MS } from '../constants';
import { getBestMove } from '../services/geminiService';

interface BoardProps {
  game: GameSession;
  currentUser: User;
  onMove: (move: string, fen: string, whiteTime: number, blackTime: number) => void;
  onGameOver: (winner: string | null, method?: string) => void;
}

const formatTime = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const Board: React.FC<BoardProps> = ({ game, currentUser, onMove, onGameOver }) => {
  const [chess, setChess] = useState(new Chess(game.fen));
  const [fen, setFen] = useState(game.fen);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Time State
  const [whiteTime, setWhiteTime] = useState(game.whiteTimeRemaining);
  const [blackTime, setBlackTime] = useState(game.blackTimeRemaining);

  // Determine user color
  const isWhite = currentUser.id === game.whiteId;
  const userColor = isWhite ? 'w' : 'b';
  const isMyTurn = game.turn === userColor;

  // Determine opponent name
  const opponentName = game.isAiGame ? (isWhite ? game.blackId : game.whiteId) : 'Opponent';

  // Sync state with parent game object on load/update
  useEffect(() => {
    try {
        const newChess = new Chess(game.fen);
        setChess(newChess);
        setFen(game.fen);
        setWhiteTime(game.whiteTimeRemaining);
        setBlackTime(game.blackTimeRemaining);
    } catch (e) {
        console.error("Error updating board state:", e);
    }
  }, [game.fen, game.whiteTimeRemaining, game.blackTimeRemaining]);

  // Timer Tick Effect
  useEffect(() => {
    if (game.status !== 'ACTIVE' || game.winnerId) return;

    const timer = setInterval(() => {
        if (game.turn === 'w') {
            setWhiteTime(prev => {
                const newVal = prev - 1000;
                if (newVal <= 0) {
                    clearInterval(timer);
                    onGameOver('black', 'timeout');
                    return 0;
                }
                return newVal;
            });
        } else {
            setBlackTime(prev => {
                const newVal = prev - 1000;
                if (newVal <= 0) {
                    clearInterval(timer);
                    onGameOver('white', 'timeout');
                    return 0;
                }
                return newVal;
            });
        }
    }, 1000);

    return () => clearInterval(timer);
  }, [game.turn, game.status, game.winnerId, onGameOver]);


  // AI Logic
  useEffect(() => {
    const checkAiTurn = async () => {
      // If it's AI game, and turn is NOT user's color, then it's Bot's turn.
      if (game.isAiGame && game.turn !== userColor && !game.winnerId && !isAiThinking) {
        setIsAiThinking(true);
        
        try {
            // Artificial delay for realism (subtracted from bot time essentially)
            await new Promise(r => setTimeout(r, AI_THINKING_TIME_MS));

            // Ensure chess instance is fresh
            const tempChess = new Chess(game.fen);
            const moves = tempChess.moves();
            
            if (moves.length === 0) {
                handleGameOver(tempChess);
                return;
            }

            const bestMove = await getBestMove(game.fen, moves);
            
            if (bestMove) {
                const moveResult = tempChess.move(bestMove);
                if (moveResult) {
                    // Bot moves, pass CURRENT local time
                    onMove(moveResult.san, tempChess.fen(), whiteTime, blackTime);
                }
            }
        } catch (e) {
            console.error("AI Move Error:", e);
        } finally {
            setIsAiThinking(false);
        }
      }
    };

    checkAiTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.fen, game.turn, game.isAiGame, userColor]);

  const handleGameOver = (chessInstance = chess) => {
    if (chessInstance.isCheckmate()) {
      onGameOver(chessInstance.turn() === 'w' ? 'black' : 'white', 'checkmate');
    } else if (chessInstance.isDraw() || chessInstance.isStalemate() || chessInstance.isThreefoldRepetition()) {
      onGameOver(null, 'draw'); 
    }
  };

  const onDrop = (sourceSquare: string, targetSquare: string): boolean => {
    // We allow dragging visually even if not turn, but we reject the drop here
    if (!isMyTurn || game.winnerId || isAiThinking) return false;

    try {
      const tempChess = new Chess(game.fen);
      const move = tempChess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', 
      });

      if (move === null) return false;

      setFen(tempChess.fen());
      // Pass CURRENT local time state up to parent
      onMove(move.san, tempChess.fen(), whiteTime, blackTime);
      
      if (tempChess.isGameOver()) {
        handleGameOver(tempChess);
      }
      return true;
    } catch (e) {
      console.error("Move error:", e);
      return false;
    }
  };

  const isWhiteTurn = game.turn === 'w';

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Game Status Banner */}
      <div className={`px-6 py-2 rounded-full font-bold text-sm tracking-wide shadow-lg border ${
          isMyTurn 
            ? 'bg-brand-600 text-white border-brand-400 animate-pulse' 
            : 'bg-dark-800 text-slate-400 border-slate-700'
      }`}>
          {game.winnerId 
             ? (game.winnerId === currentUser.id ? "🏆 YOU WON" : "❌ GAME OVER") 
             : (isMyTurn ? "🟢 YOUR TURN" : "⏳ OPPONENT'S TURN")
          }
      </div>

      {/* Opponent Info (Top) */}
      <div className={`flex justify-between items-center w-full max-w-[500px] p-3 rounded-lg border ${!isWhiteTurn ? 'border-brand-500 bg-brand-900/10' : 'border-slate-800 bg-dark-800'}`}>
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${game.turn === (isWhite ? 'b' : 'w') ? 'bg-brand-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {opponentName.charAt(0).toUpperCase()}
            </div>
            <div>
                <div className="font-bold text-slate-200 text-sm">{opponentName}</div>
                {isAiThinking && <span className="text-brand-400 text-xs animate-pulse">Thinking...</span>}
            </div>
        </div>
        <div className={`font-mono text-xl font-bold ${!isWhite ? (isWhiteTurn ? 'text-slate-500' : 'text-white') : (isWhiteTurn ? 'text-slate-500' : 'text-white')}`}>
            {formatTime(!isWhite ? whiteTime : blackTime)}
        </div>
      </div>

      {/* Board */}
      {/* touch-action: none is CRITICAL for mobile drag support */}
      <div className="w-full max-w-[500px] aspect-square shadow-2xl shadow-brand-900/20 border-4 border-slate-700 rounded-lg overflow-hidden bg-dark-800 relative" style={{ touchAction: 'none' }}>
        <Chessboard 
          position={fen} 
          onPieceDrop={onDrop}
          boardOrientation={isWhite ? 'white' : 'black'}
          customDarkSquareStyle={{ backgroundColor: '#1e293b' }}
          customLightSquareStyle={{ backgroundColor: '#475569' }}
          // Enable dragging visually so user can test touch, but logic restricts actual moves in onDrop
          arePiecesDraggable={!game.winnerId} 
          animationDuration={200}
        />
        
        {/* Helper overlay for turn state if needed (optional) */}
        {!isMyTurn && !game.winnerId && (
            <div className="absolute inset-0 bg-black/10 pointer-events-none" />
        )}
      </div>

      {/* User Info (Bottom) */}
      <div className={`flex justify-between items-center w-full max-w-[500px] p-3 rounded-lg border ${isWhiteTurn ? 'border-brand-500 bg-brand-900/10' : 'border-slate-800 bg-dark-800'}`}>
        <div className="flex items-center gap-3">
             <div className={`w-8 h-8 rounded-full flex items-center justify-center ${game.turn === (isWhite ? 'w' : 'b') ? 'bg-brand-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {currentUser.email.charAt(0).toUpperCase()}
            </div>
            <div>
                <div className="font-bold text-slate-200 text-sm">You</div>
                <div className="text-xs text-brand-400 font-mono">${game.wager} Pot</div>
            </div>
        </div>
        <div className={`font-mono text-xl font-bold ${isWhite ? (isWhiteTurn ? 'text-white' : 'text-slate-500') : (isWhiteTurn ? 'text-white' : 'text-slate-500')}`}>
            {formatTime(isWhite ? whiteTime : blackTime)}
        </div>
      </div>
    </div>
  );
};
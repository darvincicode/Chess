import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { GameSession, User } from '../types';
import { AI_THINKING_TIME_MS } from '../constants';
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
  // Single source of truth for the board state is the FEN string
  const [fen, setFen] = useState(game.fen);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // CLICK-TO-MOVE STATE
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, any>>({});

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
    if (game.fen !== fen) {
        setFen(game.fen);
        // Reset selection if board updates externally (e.g. opponent moved)
        setMoveFrom(null);
        setOptionSquares({});
    }
    setWhiteTime(game.whiteTimeRemaining);
    setBlackTime(game.blackTimeRemaining);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            await new Promise(r => setTimeout(r, AI_THINKING_TIME_MS));

            // Use fresh instance based on current FEN
            const tempChess = new Chess(game.fen);
            
            if (tempChess.isGameOver()) {
                handleGameOver(tempChess);
                return;
            }

            const moves = tempChess.moves();
            if (moves.length === 0) return;

            const bestMove = await getBestMove(game.fen, moves);
            
            if (bestMove) {
                try {
                    const moveResult = tempChess.move(bestMove);
                    if (moveResult) {
                        onMove(moveResult.san, tempChess.fen(), whiteTime, blackTime);
                    }
                } catch (e) {
                    // Fallback to random if AI move is invalid
                    console.warn("AI invalid move, falling back to random");
                    const randomMove = moves[Math.floor(Math.random() * moves.length)];
                    tempChess.move(randomMove);
                    onMove(randomMove, tempChess.fen(), whiteTime, blackTime);
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

  const handleGameOver = (chessInstance: any) => {
    if (chessInstance.isCheckmate()) {
      onGameOver(chessInstance.turn() === 'w' ? 'black' : 'white', 'checkmate');
    } else if (chessInstance.isDraw() || chessInstance.isStalemate() || chessInstance.isThreefoldRepetition()) {
      onGameOver(null, 'draw'); 
    }
  };

  // --- MOVE LOGIC ---

  const getMoveOptions = (square: string) => {
    const tempChess = new Chess(fen);
    const moves = tempChess.moves({
      square: square as any,
      verbose: true,
    });
    
    if (moves.length === 0) {
      return {};
    }

    const newOptionSquares: Record<string, any> = {};
    
    // Highlight source square
    newOptionSquares[square] = {
      background: 'rgba(255, 255, 0, 0.5)',
    };

    // Highlight valid moves
    moves.forEach((move) => {
      const isCapture = tempChess.get(move.to as any) && tempChess.get(move.to as any).color !== tempChess.get(square as any).color;
      
      newOptionSquares[move.to] = {
        background: isCapture 
            ? 'radial-gradient(circle, rgba(255, 80, 80, 0.7) 40%, transparent 40%)' // Reddish for capture
            : 'radial-gradient(circle, rgba(100, 255, 100, 0.5) 25%, transparent 25%)', // Greenish for normal move
        borderRadius: '50%',
        cursor: 'pointer'
      };
    });
    return newOptionSquares;
  };

  const onSquareClick = (square: string) => {
    if (!isMyTurn || game.winnerId || isAiThinking) return;

    // 1. If we click the same square twice, deselect
    if (moveFrom === square) {
        setMoveFrom(null);
        setOptionSquares({});
        return;
    }

    // 2. If a piece is already selected, try to move to the new square
    if (moveFrom) {
        try {
            const tempChess = new Chess(fen);
            const move = tempChess.move({
                from: moveFrom,
                to: square,
                promotion: 'q', // Always promote to queen for simplicity
            });

            // If move is valid
            if (move) {
                const newFen = tempChess.fen();
                setFen(newFen);
                setMoveFrom(null);
                setOptionSquares({});
                onMove(move.san, newFen, whiteTime, blackTime);
                if (tempChess.isGameOver()) handleGameOver(tempChess);
                return;
            }
        } catch (e) {
            // Invalid move caught by chess.js, fall through to re-selection
        }
    }

    // 3. If no valid move was made, check if we clicked on one of OUR pieces to select it
    const tempChess = new Chess(fen);
    const piece = tempChess.get(square as any);

    if (piece && piece.color === userColor) {
        setMoveFrom(square);
        const options = getMoveOptions(square);
        setOptionSquares(options);
    } else {
        // Clicked empty square or opponent piece without valid move -> Deselect
        setMoveFrom(null);
        setOptionSquares({});
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
             : (isMyTurn ? "🟢 YOUR TURN - Click piece then click destination" : "⏳ OPPONENT'S TURN")
          }
      </div>

      {/* Opponent Info */}
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
      <div className="w-full max-w-[500px] aspect-square shadow-2xl shadow-brand-900/20 border-4 border-slate-700 rounded-lg overflow-hidden bg-dark-800 relative" style={{ touchAction: 'none' }}>
        <Chessboard 
          id="BasicBoard"
          position={fen} 
          onSquareClick={onSquareClick}
          customSquareStyles={optionSquares}
          boardOrientation={isWhite ? 'white' : 'black'}
          customDarkSquareStyle={{ backgroundColor: '#1e293b' }}
          customLightSquareStyle={{ backgroundColor: '#475569' }}
          arePiecesDraggable={false} // Force click-to-move interactions
          animationDuration={200}
        />
        {!isMyTurn && !game.winnerId && (
            <div className="absolute inset-0 bg-black/10 z-10 flex items-center justify-center">
                <div className="bg-black/50 text-white px-3 py-1 rounded text-sm backdrop-blur-sm">
                    Waiting for opponent...
                </div>
            </div>
        )}
      </div>

      {/* User Info */}
      <div className={`flex justify-between items-center w-full max-w-[500px] p-3 rounded-lg border ${isWhiteTurn ? 'border-brand-500 bg-brand-900/10' : 'border-slate-800 bg-dark-800'}`}>
        <div className="flex items-center gap-3">
             <div className={`w-8 h-8 rounded-full flex items-center justify-center ${game.turn === (isWhite ? 'w' : 'b') ? 'bg-brand-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {currentUser.email.charAt(0).toUpperCase()}
            </div>
            <div>
                <div className="font-bold text-slate-200 text-sm">
                    You <span className="text-xs font-normal text-slate-400">({isWhite ? 'White' : 'Black'})</span>
                </div>
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
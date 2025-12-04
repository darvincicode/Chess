import React, { useState, useEffect, useCallback } from 'react';
import { Chess, Move } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { GameSession, User } from '../types';
import { GEMINI_MODEL_ID, AI_THINKING_TIME_MS } from '../constants';
import { getBestMove } from '../services/geminiService';

interface BoardProps {
  game: GameSession;
  currentUser: User;
  onMove: (move: string, fen: string) => void;
  onGameOver: (winner: string | null) => void;
}

export const Board: React.FC<BoardProps> = ({ game, currentUser, onMove, onGameOver }) => {
  const [chess, setChess] = useState(new Chess(game.fen));
  const [fen, setFen] = useState(game.fen);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Determine user color
  const isWhite = currentUser.id === game.whiteId;
  const userColor = isWhite ? 'w' : 'b';
  const isMyTurn = game.turn === userColor;

  // Determine opponent name
  const opponentName = game.isAiGame ? game.blackId : 'Opponent';

  useEffect(() => {
    const newChess = new Chess(game.fen);
    setChess(newChess);
    setFen(game.fen);
  }, [game.fen]);

  // AI Logic
  useEffect(() => {
    const checkAiTurn = async () => {
      if (game.isAiGame && game.turn !== userColor && !game.winnerId && !isAiThinking) {
        setIsAiThinking(true);
        
        // Artificial delay for realism
        await new Promise(r => setTimeout(r, AI_THINKING_TIME_MS));

        const moves = chess.moves();
        if (moves.length === 0) {
            handleGameOver();
            setIsAiThinking(false);
            return;
        }

        const bestMove = await getBestMove(chess.fen(), moves);
        
        if (bestMove) {
          try {
            const moveResult = chess.move(bestMove);
            if (moveResult) {
               onMove(moveResult.san, chess.fen());
               if (chess.isGameOver()) {
                 handleGameOver();
               }
            }
          } catch (e) {
            console.error("Move error", e);
          }
        }
        setIsAiThinking(false);
      }
    };

    checkAiTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.fen, game.turn, game.isAiGame, userColor]);

  const handleGameOver = () => {
    if (chess.isCheckmate()) {
      onGameOver(chess.turn() === 'w' ? 'black' : 'white');
    } else if (chess.isDraw() || chess.isStalemate()) {
      onGameOver(null); // Draw
    }
  };

  const onDrop = (sourceSquare: string, targetSquare: string): boolean => {
    if (!isMyTurn || game.winnerId) return false;

    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // always promote to queen for simplicity
      });

      if (move === null) return false;

      setFen(chess.fen());
      onMove(move.san, chess.fen());
      
      if (chess.isGameOver()) {
        handleGameOver();
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex justify-between w-full max-w-[500px] text-slate-400 font-mono text-sm">
        <div className="flex items-center gap-2">
          {/* Use a generic user icon or just the circle for the bot to look human */}
          <div className={`w-3 h-3 rounded-full ${game.turn === 'b' ? 'bg-brand-500 animate-pulse' : 'bg-slate-700'}`} />
          <span className="font-bold text-slate-200">{opponentName}</span>
          {/* Thinking indicator looks like natural player behavior */}
          {isAiThinking && <span className="text-brand-400 text-xs animate-pulse opacity-75">Thinking...</span>}
        </div>
        <div>
           Balance: ${game.wager}
        </div>
      </div>

      <div className="w-full max-w-[500px] aspect-square shadow-2xl shadow-brand-900/20 border-4 border-slate-700 rounded-lg overflow-hidden bg-dark-800">
        <Chessboard 
          position={fen} 
          onPieceDrop={onDrop}
          boardOrientation={isWhite ? 'white' : 'black'}
          customDarkSquareStyle={{ backgroundColor: '#1e293b' }}
          customLightSquareStyle={{ backgroundColor: '#475569' }}
          arePiecesDraggable={isMyTurn && !game.winnerId} 
        />
      </div>

      <div className="flex justify-between w-full max-w-[500px] text-slate-400 font-mono text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${game.turn === 'w' ? 'bg-brand-500 animate-pulse' : 'bg-slate-700'}`} />
          <span>You ({userColor === 'w' ? 'White' : 'Black'})</span>
        </div>
        <div className="text-xs text-slate-500">
          {game.history.length > 0 ? `Last: ${game.history[game.history.length - 1]}` : 'Start Game'}
        </div>
      </div>
    </div>
  );
};
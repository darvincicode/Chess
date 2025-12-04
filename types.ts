
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export enum Network {
  TRC20 = 'TRC20',
  ERC20 = 'ERC20',
  BEP20 = 'BEP20'
}

export interface User {
  id: string;
  email: string; // Acts as username/email
  password?: string; // Stored for mock auth
  role: UserRole;
  balance: number; // In USDT
  isBanned: boolean;
  wins: number;
  losses: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'GAME_FEE' | 'GAME_WIN';
  amount: number;
  network?: Network;
  address?: string;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  timestamp: number;
  txHash?: string;
}

export interface GameSession {
  id: string;
  whiteId: string;
  blackId: string;
  wager: number;
  fen: string;
  turn: 'w' | 'b';
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED';
  winnerId?: string | null;
  history: string[]; // SAN moves
  isAiGame: boolean;
  lastMoveTimestamp: number;
  
  // Time Controls
  timeControlMinutes: number;
  whiteTimeRemaining: number; // milliseconds
  blackTimeRemaining: number; // milliseconds
}

export interface AdminSettings {
  walletTrc20: string;
  walletErc20: string;
  walletBep20: string;
  minDeposit: number;
  minWithdraw: number;
  minWager: number;
}
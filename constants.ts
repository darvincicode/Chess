import { AdminSettings } from './types';

export const INITIAL_SETTINGS: AdminSettings = {
  walletTrc20: 'T9yD14Nj9j7xAB4dbGeiX9h8zzCyrXYZ', // Fake default
  walletErc20: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', // Fake default
  walletBep20: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', // Fake default
  minDeposit: 5,
  minWithdraw: 5,
  minWager: 0.1,
};

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const GEMINI_MODEL_ID = 'gemini-2.5-flash';

// Simulated delays
export const AI_THINKING_TIME_MS = 1500;
export const MATCHMAKING_TIMEOUT_MS = 60000; // 1 minute
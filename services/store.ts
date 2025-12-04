import { User, Transaction, GameSession, UserRole, AdminSettings } from '../types';
import { INITIAL_SETTINGS } from '../constants';

// In-memory store backed by localStorage for persistence in this demo
class MockStore {
  private users: User[] = [];
  private transactions: Transaction[] = [];
  private games: GameSession[] = [];
  private settings: AdminSettings = INITIAL_SETTINGS;
  private currentUser: User | null = null;

  constructor() {
    this.load();
  }

  private save() {
    localStorage.setItem('chess_app_data', JSON.stringify({
      users: this.users,
      transactions: this.transactions,
      settings: this.settings,
      games: this.games
    }));
  }

  private load() {
    const data = localStorage.getItem('chess_app_data');
    if (data) {
      const parsed = JSON.parse(data);
      this.users = parsed.users || [];
      this.transactions = parsed.transactions || [];
      this.settings = parsed.settings || INITIAL_SETTINGS;
      this.games = parsed.games || [];
    } else {
      // Create a default admin with username 'admin' and password '123456'
      this.createUser('admin', '123456', UserRole.ADMIN);
    }
  }

  // Auth
  login(email: string, pass: string): User | null {
    const user = this.users.find(u => u.email === email);
    if (user && !user.isBanned) {
      // Simple password check
      if (user.password === pass) {
        this.currentUser = user;
        return user;
      }
    }
    return null;
  }

  logout() {
    this.currentUser = null;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  createUser(email: string, pass: string, role: UserRole = UserRole.USER): User {
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      password: pass,
      role,
      balance: role === UserRole.ADMIN ? 999999 : 0,
      isBanned: false,
      wins: 0,
      losses: 0
    };
    this.users.push(newUser);
    this.save();
    return newUser;
  }

  // Wallet
  createTransaction(tx: Omit<Transaction, 'id' | 'timestamp' | 'status'>): Transaction {
    const newTx: Transaction = {
      ...tx,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      status: 'PENDING'
    };
    this.transactions.push(newTx);
    this.save();
    return newTx;
  }

  getTransactions(userId?: string): Transaction[] {
    if (userId) return this.transactions.filter(t => t.userId === userId);
    return this.transactions;
  }

  updateTransactionStatus(txId: string, status: Transaction['status']) {
    const tx = this.transactions.find(t => t.id === txId);
    if (tx) {
      tx.status = status;
      if (status === 'COMPLETED') {
        const user = this.users.find(u => u.id === tx.userId);
        if (user) {
          if (tx.type === 'DEPOSIT') user.balance += tx.amount;
          if (tx.type === 'WITHDRAW') user.balance -= tx.amount; 
        }
      }
      this.save();
    }
  }

  // Game
  updateBalance(userId: string, amount: number) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.balance += amount;
      this.save();
    }
  }

  getUsers(): User[] {
    return this.users;
  }

  updateUser(id: string, updates: Partial<User>) {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.users[idx] = { ...this.users[idx], ...updates };
      this.save();
    }
  }

  // Admin
  getSettings(): AdminSettings {
    return this.settings;
  }

  updateSettings(newSettings: AdminSettings) {
    this.settings = newSettings;
    this.save();
  }
}

export const store = new MockStore();
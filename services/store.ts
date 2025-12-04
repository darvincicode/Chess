import { User, Transaction, GameSession, UserRole, AdminSettings } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- SUPABASE CONFIGURATION ---

export const getSupabaseConfig = () => {
    return {
        // Use provided credentials as default if not in localStorage
        url: localStorage.getItem('sb_url') || 'https://ptyfpfcdmxfwyvkqixbb.supabase.co',
        key: localStorage.getItem('sb_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0eWZwZmNkbXhmd3l2a3FpeGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NzYxMzMsImV4cCI6MjA4MDM1MjEzM30.iZfEQIIrIXfi5JnRvglXfgZ4gyNVuCXMgM2-r34LT0w'
    };
};

export const saveSupabaseConfig = (url: string, key: string) => {
    localStorage.setItem('sb_url', url);
    localStorage.setItem('sb_key', key);
    window.location.reload(); // Reload to re-init store
};

// --- INTERFACE ---

interface IStore {
  init(): Promise<void>;
  login(email: string, pass: string): Promise<User | null>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  createUser(email: string, pass: string, role?: UserRole): Promise<User | null>;
  
  // Game
  updateBalance(userId: string, amount: number): Promise<void>;
  
  // Admin / Data
  getUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<User>): Promise<void>;
  
  // Transactions
  createTransaction(tx: Omit<Transaction, 'id' | 'timestamp' | 'status'>): Promise<Transaction>;
  getTransactions(userId?: string): Promise<Transaction[]>;
  updateTransactionStatus(txId: string, status: Transaction['status']): Promise<void>;
  
  // Settings
  getSettings(): Promise<AdminSettings>;
  updateSettings(newSettings: AdminSettings): Promise<void>;
}

// --- MOCK STORE (LOCAL STORAGE) ---

class MockStore implements IStore {
  private users: User[] = [];
  private transactions: Transaction[] = [];
  private settings: AdminSettings = INITIAL_SETTINGS;
  private currentUser: User | null = null;

  async init() {
    const data = localStorage.getItem('chess_app_data');
    if (data) {
      const parsed = JSON.parse(data);
      this.users = parsed.users || [];
      this.transactions = parsed.transactions || [];
      this.settings = parsed.settings || INITIAL_SETTINGS;
    } else {
      await this.createUser('admin', '123456', UserRole.ADMIN);
    }
    
    // Auto login if session persists (simple mock)
    const sessionEmail = localStorage.getItem('mock_session_email');
    if (sessionEmail) {
        this.currentUser = this.users.find(u => u.email === sessionEmail) || null;
    }
  }

  private save() {
    localStorage.setItem('chess_app_data', JSON.stringify({
      users: this.users,
      transactions: this.transactions,
      settings: this.settings
    }));
  }

  async login(email: string, pass: string): Promise<User | null> {
    // Artificial delay
    await new Promise(r => setTimeout(r, 500));
    
    const user = this.users.find(u => u.email === email);
    if (user && !user.isBanned) {
      if (user.password === pass) {
        this.currentUser = user;
        localStorage.setItem('mock_session_email', email);
        return user;
      }
    }
    return null;
  }

  async logout(): Promise<void> {
    this.currentUser = null;
    localStorage.removeItem('mock_session_email');
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  async createUser(email: string, pass: string, role: UserRole = UserRole.USER): Promise<User> {
    await new Promise(r => setTimeout(r, 500));
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      password: pass,
      role,
      balance: role === UserRole.ADMIN ? 999999 : 100, // Give 100 bonus for testing
      isBanned: false,
      wins: 0,
      losses: 0
    };
    this.users.push(newUser);
    this.save();
    return newUser;
  }

  async updateBalance(userId: string, amount: number) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.balance += amount;
      this.save();
      if (this.currentUser && this.currentUser.id === userId) {
          this.currentUser.balance = user.balance;
      }
    }
  }

  async getUsers(): Promise<User[]> {
    return this.users;
  }

  async updateUser(id: string, updates: Partial<User>) {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.users[idx] = { ...this.users[idx], ...updates };
      this.save();
    }
  }

  async createTransaction(tx: Omit<Transaction, 'id' | 'timestamp' | 'status'>): Promise<Transaction> {
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

  async getTransactions(userId?: string): Promise<Transaction[]> {
    if (userId) return this.transactions.filter(t => t.userId === userId);
    return this.transactions;
  }

  async updateTransactionStatus(txId: string, status: Transaction['status']) {
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

  async getSettings(): Promise<AdminSettings> {
    return this.settings;
  }

  async updateSettings(newSettings: AdminSettings) {
    this.settings = newSettings;
    this.save();
  }
}

// --- SUPABASE STORE ---

class SupabaseStore implements IStore {
    private client: SupabaseClient;
    private currentUser: User | null = null;
    
    constructor(url: string, key: string) {
        this.client = createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
            }
        });
    }

    async init() {
        const { data: { session } } = await this.client.auth.getSession();
        if (session) {
            await this.fetchCurrentUser(session.user.id);
            
            // AUTO-FIX ON LOAD: Ensure admin role persists across reloads if database is slightly out of sync
            if (this.currentUser && this.currentUser.email.includes('admin') && this.currentUser.role !== UserRole.ADMIN) {
                console.log("Auto-promoting admin user on init...");
                await this.updateUser(this.currentUser.id, { role: UserRole.ADMIN });
                this.currentUser.role = UserRole.ADMIN;
            }
        }
    }

    private async fetchCurrentUser(id: string) {
        const { data } = await this.client.from('profiles').select('*').eq('id', id).single();
        if (data) {
            this.currentUser = data;
        } else {
            // Profile missing (maybe deleted or failed creation). 
            this.currentUser = null; 
        }
    }

    async login(email: string, pass: string): Promise<User | null> {
        const { data, error } = await this.client.auth.signInWithPassword({ email, password: pass });
        
        if (error) {
            console.error("Login Auth Error:", error);
            throw error; // Propagate error so AuthForm can handle "Email not confirmed"
        }

        if (!data.user) return null;

        // Try to fetch existing profile
        await this.fetchCurrentUser(data.user.id);

        // RECOVERY: If Auth succeeded but no profile exists, create one now.
        if (!this.currentUser) {
            console.log("Profile missing for authenticated user. Creating default profile...");
            const recoveryUser: User = {
                id: data.user.id,
                email: email,
                role: email.includes('admin') ? UserRole.ADMIN : UserRole.USER,
                balance: 100,
                isBanned: false,
                wins: 0,
                losses: 0
            };
            const { error: dbError } = await this.client.from('profiles').insert(recoveryUser);
            if (!dbError) {
                this.currentUser = recoveryUser;
            } else {
                console.error("Failed to create recovery profile:", dbError);
                return null;
            }
        }
        
        // AUTO-FIX ADMIN ROLE: If logging in as admin but role is USER, fix it.
        if (this.currentUser && email.includes('admin') && this.currentUser.role !== UserRole.ADMIN) {
            console.log("Auto-promoting admin user...");
            await this.updateUser(this.currentUser.id, { role: UserRole.ADMIN });
            this.currentUser.role = UserRole.ADMIN;
        }

        return this.currentUser;
    }

    async logout(): Promise<void> {
        await this.client.auth.signOut();
        this.currentUser = null;
    }

    async getCurrentUser(): Promise<User | null> {
        return this.currentUser;
    }

    async createUser(email: string, pass: string, role: UserRole = UserRole.USER): Promise<User | null> {
        const { data, error } = await this.client.auth.signUp({ 
            email, 
            password: pass,
            options: {
                data: { role } // Meta data for triggers
            }
        });
        
        if (error || !data.user) {
            console.error("Signup error", error);
            throw error; // Propagate error
        }

        // Create profile manually if trigger doesn't exist
        const newUser: User = {
            id: data.user.id,
            email: email,
            role: role,
            balance: 100, // Sign up bonus
            isBanned: false,
            wins: 0,
            losses: 0
        };

        // Try insert profile - ignore error if it already exists (e.g. via trigger)
        const { error: dbError } = await this.client.from('profiles').insert(newUser);
        if (dbError) console.log("Profile insert info (might exist):", dbError.message);

        this.currentUser = newUser;
        return newUser;
    }

    async updateBalance(userId: string, amount: number): Promise<void> {
        // Use RPC or direct update
        const { data } = await this.client.from('profiles').select('balance').eq('id', userId).single();
        if (data) {
            const newBal = data.balance + amount;
            await this.client.from('profiles').update({ balance: newBal }).eq('id', userId);
            if (this.currentUser && this.currentUser.id === userId) this.currentUser.balance = newBal;
        }
    }

    async getUsers(): Promise<User[]> {
        const { data } = await this.client.from('profiles').select('*');
        return data || [];
    }

    async updateUser(id: string, updates: Partial<User>): Promise<void> {
        // Remove password from updates if it exists as it is handled by auth
        const { password, ...safeUpdates } = updates;
        
        if (password) {
            await this.client.auth.updateUser({ password: password });
        }
        
        if (Object.keys(safeUpdates).length > 0) {
            await this.client.from('profiles').update(safeUpdates).eq('id', id);
        }
    }

    async createTransaction(tx: Omit<Transaction, 'id' | 'timestamp' | 'status'>): Promise<Transaction> {
        const newTx = {
            ...tx,
            status: 'PENDING',
            timestamp: Date.now()
        };
        const { data } = await this.client.from('transactions').insert(newTx).select().single();
        return data as Transaction;
    }

    async getTransactions(userId?: string): Promise<Transaction[]> {
        let query = this.client.from('transactions').select('*');
        if (userId) query = query.eq('userId', userId);
        const { data } = await query;
        return data as Transaction[] || [];
    }

    async updateTransactionStatus(txId: string, status: Transaction['status']): Promise<void> {
        const { data: tx } = await this.client.from('transactions').select('*').eq('id', txId).single();
        if (!tx) return;

        if (status === 'COMPLETED') {
             // Logic should ideally be in a Postgres Function (Database Transaction)
             const { data: user } = await this.client.from('profiles').select('*').eq('id', tx.userId).single();
             if (user) {
                 let newBal = user.balance;
                 if (tx.type === 'DEPOSIT') newBal += tx.amount;
                 if (tx.type === 'WITHDRAW') newBal -= tx.amount;
                 await this.client.from('profiles').update({ balance: newBal }).eq('id', user.id);
             }
        }
        await this.client.from('transactions').update({ status }).eq('id', txId);
    }

    async getSettings(): Promise<AdminSettings> {
        // Mock for settings as they are usually config file
        return INITIAL_SETTINGS;
    }

    async updateSettings(newSettings: AdminSettings): Promise<void> {
        // No-op for now
    }
}

// --- FACTORY ---

const config = getSupabaseConfig();
export const store = (config.url && config.key) 
    ? new SupabaseStore(config.url, config.key) 
    : new MockStore();

// Initialize immediately
store.init();
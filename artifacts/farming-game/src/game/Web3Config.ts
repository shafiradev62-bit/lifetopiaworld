/**
 * REAL Solana Wallet Connection - Phantom & More
 * Direct connection to Solana wallets without blocking
 */

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  walletName: string | null;
}

export interface ConnectResult {
  publicKey?: string;
  provider?: any;
  walletName?: string;
}

function getProvider(walletType?: string): { provider: any; name: string } | null {
  const w = window as any;
  
  if (walletType === 'phantom' || !walletType) {
    const phantomSol = w.phantom?.solana;
    if (phantomSol?.isPhantom || w.solana?.isPhantom) {
      return { provider: phantomSol || w.solana, name: 'Phantom' };
    }
  }
  
  if (walletType === 'solflare' || !walletType) {
    if (w.solflare?.isSolflare) {
      return { provider: w.solflare, name: 'Solflare' };
    }
  }
  
  if (walletType === 'backpack' || !walletType) {
    if (w.backpack?.isBackpack) {
      return { provider: w.backpack, name: 'Backpack' };
    }
  }
  
  if (w.solana && w.solana.isPhantom) {
    return { provider: w.solana, name: 'Phantom' };
  }
  
  return null;
}

class SolanaWalletConnector {
  private state: WalletState = { connected: false, publicKey: null, walletName: null };
  private subscribers: Array<(state: WalletState) => void> = [];

  async connect(walletType?: string): Promise<ConnectResult | undefined> {
    try {
      const wallet = getProvider(walletType);
      
      if (wallet) {
        const provider = wallet.provider;
        
        let response: any;
        try {
          response = await provider.connect({ onlyIfTrusted: true });
        } catch (e) {
          response = await provider.connect();
        }
        
        const publicKey = response?.publicKey?.toString() || provider.publicKey?.toString();
        
        if (!publicKey) {
          throw new Error('No public key returned');
        }
        
        this.state = {
          connected: true,
          publicKey: publicKey,
          walletName: wallet.name
        };
        
        this.notify();
        console.log('[Wallet] Connected to', wallet.name, publicKey);
        return { publicKey, provider, walletName: wallet.name };
      }
      
      if (!confirm('Solana wallet not detected!\n\nInstall Phantom wallet?\n\n1. Click OK to open Phantom website\n2. Install the extension\n3. Create/import wallet\n4. Refresh this page')) {
        return undefined;
      }
      
      window.open('https://phantom.app/', '_blank');
      return undefined;
      
    } catch (error: any) {
      console.error('[Wallet] Connection error:', error);
      alert('Wallet connection failed: ' + (error.message || 'Unknown error'));
      return undefined;
    }
  }

  async disconnect() {
    try {
      const wallet = getProvider();
      if (wallet) {
        await wallet.provider.disconnect();
      }
    } catch (e) {
      console.warn('[Wallet] Disconnect error:', e);
    }
    
    this.state = { connected: false, publicKey: null, walletName: null };
    this.notify();
  }

  getState(): WalletState {
    return this.state;
  }

  subscribeState(callback: (state: WalletState) => void) {
    this.subscribers.push(callback);
    return () => {
      const idx = this.subscribers.indexOf(callback);
      if (idx >= 0) this.subscribers.splice(idx, 1);
    };
  }

  private notify() {
    this.subscribers.forEach(cb => cb(this.state));
  }
}

export const solanaWallet = new SolanaWalletConnector();
export { getProvider };

// Global window type augmentations are now in solanaToken.ts
// to keep all wallet types in one place.

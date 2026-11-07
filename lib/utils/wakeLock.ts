// ============================================================================
// lib/utils/wakeLock.ts — Screen Wake Lock API Manager for Kitchen KDS
// ============================================================================

export type WakeLockStatusListener = (active: boolean, supported: boolean) => void;

class ScreenWakeLockManager {
  private sentinel: any = null;
  private isRequested: boolean = false;
  private listeners: Set<WakeLockStatusListener> = new Set();
  private visibilityListenerAttached: boolean = false;

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'navigator' in window && 'wakeLock' in navigator;
  }

  public isActive(): boolean {
    return !!this.sentinel && !this.sentinel.released;
  }

  public subscribe(listener: WakeLockStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.isActive(), this.isSupported());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const active = this.isActive();
    const supported = this.isSupported();
    for (const listener of this.listeners) {
      try {
        listener(active, supported);
      } catch (err) {
        console.error('[wakeLock] Error in status listener:', err);
      }
    }
  }

  private ensureVisibilityListener() {
    if (this.visibilityListenerAttached || typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && this.isRequested && !this.isActive()) {
        console.log('[wakeLock] Visibility changed to visible, re-acquiring wake lock...');
        await this.acquire();
      }
    });
    this.visibilityListenerAttached = true;
  }

  private async acquire(): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('[wakeLock] Screen Wake Lock API is not supported on this browser.');
      this.notifyListeners();
      return false;
    }

    try {
      this.sentinel = await (navigator as any).wakeLock.request('screen');
      console.log('[wakeLock] Screen Wake Lock acquired successfully.');

      this.sentinel.addEventListener('release', () => {
        console.log('[wakeLock] Screen Wake Lock released by system.');
        this.notifyListeners();
      });

      this.notifyListeners();
      return true;
    } catch (err) {
      console.warn('[wakeLock] Failed to acquire Screen Wake Lock:', err);
      this.sentinel = null;
      this.notifyListeners();
      return false;
    }
  }

  public async request(): Promise<boolean> {
    this.isRequested = true;
    this.ensureVisibilityListener();
    return await this.acquire();
  }

  public async release(): Promise<void> {
    this.isRequested = false;
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (err) {
        console.warn('[wakeLock] Error releasing wake lock:', err);
      }
      this.sentinel = null;
    }
    this.notifyListeners();
  }
}

export const wakeLockManager = new ScreenWakeLockManager();

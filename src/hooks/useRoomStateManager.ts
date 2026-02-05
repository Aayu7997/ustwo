import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Global Room State Manager with IndexedDB persistence
 * Prevents room state loss on tab switch/visibility changes
 */

const DB_NAME = 'ustowo_room_state';
const DB_VERSION = 1;
const STORE_NAME = 'room_state';

interface RoomState {
  roomId: string;
  peerId?: string;
  role: 'host' | 'guest';
  playbackTime: number;
  isPlaying: boolean;
  currentMediaUrl?: string;
  currentMediaType?: string;
  gameState?: any;
  callState?: string;
  lastUpdated: number;
}

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('[RoomState] IndexedDB open failed');
      reject(request.error);
    };
    
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'roomId' });
      }
    };
  });
  
  return dbPromise;
};

export const useRoomStateManager = (roomId: string) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const stateRef = useRef<RoomState | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load state from IndexedDB
  const loadState = useCallback(async (): Promise<RoomState | null> => {
    if (!roomId) return null;
    
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(roomId);
        
        request.onsuccess = () => {
          const state = request.result;
          // Only return if state is less than 24 hours old
          if (state && Date.now() - state.lastUpdated < 24 * 60 * 60 * 1000) {
            stateRef.current = state;
            resolve(state);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = () => {
          console.error('[RoomState] Load failed');
          resolve(null);
        };
      });
    } catch (e) {
      console.log('[RoomState] IndexedDB not available, using memory');
      return null;
    }
  }, [roomId]);

  // Save state to IndexedDB (debounced)
  const saveState = useCallback((partialState: Partial<RoomState>) => {
    if (!roomId) return;
    
    // Merge with existing state
    const newState: RoomState = {
      ...stateRef.current,
      ...partialState,
      roomId,
      lastUpdated: Date.now()
    } as RoomState;
    
    stateRef.current = newState;
    
    // Debounce save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(newState);
      } catch (e) {
        console.log('[RoomState] Save failed, using memory only');
      }
    }, 100);
  }, [roomId]);

  // Clear state
  const clearState = useCallback(async () => {
    if (!roomId) return;
    
    stateRef.current = null;
    
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(roomId);
    } catch (e) {
      console.log('[RoomState] Clear failed');
    }
  }, [roomId]);

  // Update playback time
  const updatePlayback = useCallback((time: number, isPlaying: boolean) => {
    saveState({ playbackTime: time, isPlaying });
  }, [saveState]);

  // Update media source
  const updateMediaSource = useCallback((url: string, type: string) => {
    saveState({ currentMediaUrl: url, currentMediaType: type });
  }, [saveState]);

  // Update game state
  const updateGameState = useCallback((gameState: any) => {
    saveState({ gameState });
  }, [saveState]);

  // Update call state
  const updateCallState = useCallback((callState: string) => {
    saveState({ callState });
  }, [saveState]);

  // Initialize on mount
  useEffect(() => {
    if (!roomId) return;
    
    const init = async () => {
      await loadState();
      setIsInitialized(true);
    };
    
    init();
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [roomId, loadState]);

  return {
    isInitialized,
    currentState: stateRef.current,
    loadState,
    saveState,
    clearState,
    updatePlayback,
    updateMediaSource,
    updateGameState,
    updateCallState
  };
};

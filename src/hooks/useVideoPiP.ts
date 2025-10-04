import { useState, useCallback, useEffect } from 'react';

export type PipMode = 'pip' | 'full' | 'minimized';
export type PipPosition = 'custom' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

interface VideoPiPState {
  mode: PipMode;
  position: PipPosition;
  isDragging: boolean;
  customPosition: { x: number; y: number };
}

const STORAGE_KEY = 'ustuo_video_pip_preferences';

export const useVideoPiP = () => {
  const [state, setState] = useState<VideoPiPState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall through to default
      }
    }
    return {
      mode: 'pip' as PipMode,
      position: 'bottom-right' as PipPosition,
      isDragging: false,
      customPosition: { x: window.innerWidth - 300, y: window.innerHeight - 250 }
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: state.mode,
      position: state.position,
      isDragging: false,
      customPosition: state.customPosition
    }));
  }, [state.mode, state.position, state.customPosition]);

  const setMode = useCallback((mode: PipMode) => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  const setPosition = useCallback((position: PipPosition) => {
    setState(prev => ({ ...prev, position }));
  }, []);

  const setCustomPosition = useCallback((x: number, y: number) => {
    setState(prev => ({ 
      ...prev, 
      position: 'custom',
      customPosition: { x, y }
    }));
  }, []);

  const toggleMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: prev.mode === 'pip' ? 'full' : prev.mode === 'full' ? 'minimized' : 'pip'
    }));
  }, []);

  const startDrag = useCallback(() => {
    setState(prev => ({ ...prev, isDragging: true }));
  }, []);

  const endDrag = useCallback(() => {
    setState(prev => ({ ...prev, isDragging: false }));
  }, []);

  const updateDragPosition = useCallback((x: number, y: number) => {
    setState(prev => ({
      ...prev,
      position: 'custom',
      customPosition: { x, y }
    }));
  }, []);

  return {
    ...state,
    setMode,
    setPosition,
    setCustomPosition,
    toggleMode,
    startDrag,
    endDrag,
    updateDragPosition
  };
};

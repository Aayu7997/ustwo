import { useState, useCallback, useEffect } from 'react';

export type PipMode = 'pip' | 'full' | 'minimized';
export type PipPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

interface VideoPiPState {
  mode: PipMode;
  position: PipPosition;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
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
      dragOffset: { x: 0, y: 0 }
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: state.mode,
      position: state.position,
      isDragging: false,
      dragOffset: state.dragOffset
    }));
  }, [state.mode, state.position, state.dragOffset]);

  const setMode = useCallback((mode: PipMode) => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  const setPosition = useCallback((position: PipPosition) => {
    setState(prev => ({ ...prev, position }));
  }, []);

  const toggleMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: prev.mode === 'pip' ? 'full' : prev.mode === 'full' ? 'minimized' : 'pip'
    }));
  }, []);

  const startDrag = useCallback((offsetX: number, offsetY: number) => {
    setState(prev => ({
      ...prev,
      isDragging: true,
      dragOffset: { x: offsetX, y: offsetY }
    }));
  }, []);

  const endDrag = useCallback(() => {
    setState(prev => ({ ...prev, isDragging: false }));
  }, []);

  return {
    ...state,
    setMode,
    setPosition,
    toggleMode,
    startDrag,
    endDrag
  };
};

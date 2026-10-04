'use client';

import { useState, useCallback, useRef } from 'react';
import {
  EditorSettings,
  DEFAULT_EDITOR_SETTINGS,
  DEFAULT_TRANSFORM,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_SHADOW_SETTINGS,
  DEFAULT_BORDER_SETTINGS,
} from '@/types/image';

const MAX_HISTORY = 30;

export interface EditorHistoryReturn {
  settings: EditorSettings;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  updateSettings: (newSettings: EditorSettings, addToHistory?: boolean) => void;
  commitSettingsToHistory: (newSettings: EditorSettings) => void;
  resetAll: () => void;
  resetSection: (
    section: 'position' | 'background' | 'shadow' | 'border' | 'adjustments' | 'composition'
  ) => void;
}

export function useEditorHistory(
  initialSettings: EditorSettings,
  onChange?: (settings: EditorSettings) => void
): EditorHistoryReturn {
  const [history, setHistory] = useState<EditorSettings[]>([initialSettings]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Keep a stable ref of current settings for rapid updates
  const settingsRef = useRef(initialSettings);
  settingsRef.current = history[currentIndex] || initialSettings;

  const currentSettings = history[currentIndex] || initialSettings;

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const updateSettings = useCallback(
    (newSettings: EditorSettings, addToHistory = false) => {
      if (addToHistory) {
        setHistory((prev) => {
          const trimmed = prev.slice(0, currentIndex + 1);
          const next = [...trimmed, newSettings];
          if (next.length > MAX_HISTORY) {
            next.shift();
          }
          return next;
        });
        setCurrentIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
      } else {
        // Fast in-place update for smooth dragging / slider scrub without history bloat
        setHistory((prev) => {
          const copy = [...prev];
          copy[currentIndex] = newSettings;
          return copy;
        });
      }
      onChange?.(newSettings);
    },
    [currentIndex, onChange]
  );

  const commitSettingsToHistory = useCallback(
    (newSettings: EditorSettings) => {
      setHistory((prev) => {
        const trimmed = prev.slice(0, currentIndex + 1);
        const next = [...trimmed, newSettings];
        if (next.length > MAX_HISTORY) {
          next.shift();
        }
        return next;
      });
      setCurrentIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
      onChange?.(newSettings);
    },
    [currentIndex, onChange]
  );

  const undo = useCallback(() => {
    if (canUndo) {
      const nextIndex = currentIndex - 1;
      setCurrentIndex(nextIndex);
      onChange?.(history[nextIndex]);
    }
  }, [canUndo, currentIndex, history, onChange]);

  const redo = useCallback(() => {
    if (canRedo) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      onChange?.(history[nextIndex]);
    }
  }, [canRedo, currentIndex, history, onChange]);

  const resetAll = useCallback(() => {
    const reset = { ...DEFAULT_EDITOR_SETTINGS };
    commitSettingsToHistory(reset);
  }, [commitSettingsToHistory]);

  const resetSection = useCallback(
    (
      section: 'position' | 'background' | 'shadow' | 'border' | 'adjustments' | 'composition'
    ) => {
      const current = settingsRef.current;
      let updated: EditorSettings = { ...current };

      switch (section) {
        case 'position':
          updated = {
            ...current,
            positioning: 'contain',
            padding: 8,
            transform: { ...DEFAULT_TRANSFORM },
          };
          break;
        case 'background':
          updated = {
            ...current,
            backgroundType: 'transparent',
            customColor: '#ffffff',
            bgImageSettings: null,
          };
          break;
        case 'shadow':
          updated = {
            ...current,
            shadow: false,
            shadowBlur: 20,
            shadowOpacity: 0.25,
            shadowOffsetY: 12,
            shadowSettings: { ...DEFAULT_SHADOW_SETTINGS },
          };
          break;
        case 'border':
          updated = {
            ...current,
            borderSettings: { ...DEFAULT_BORDER_SETTINGS },
          };
          break;
        case 'adjustments':
          updated = {
            ...current,
            adjustments: { ...DEFAULT_ADJUSTMENTS },
          };
          break;
        case 'composition':
          updated = {
            ...current,
            aspectRatio: 'original',
            crop: null,
          };
          break;
      }

      commitSettingsToHistory(updated);
    },
    [commitSettingsToHistory]
  );

  return {
    settings: currentSettings,
    canUndo,
    canRedo,
    undo,
    redo,
    updateSettings,
    commitSettingsToHistory,
    resetAll,
    resetSection,
  };
}

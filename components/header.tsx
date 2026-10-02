'use client';

import React, { useState, useEffect } from 'react';
import { AVAILABLE_MODELS } from '@/types/image';
import { isWebGPUSupported } from '@/lib/utils';
import { Scissors, Sun, Moon, ChevronDown, Check } from 'lucide-react';

interface HeaderProps {
  activeModelId: string;
  onSelectModel: (id: string) => void;
  disabled?: boolean;
}

export function Header({ activeModelId, onSelectModel, disabled }: HeaderProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [hasWebGPU, setHasWebGPU] = useState(false);

  useEffect(() => {
    setHasWebGPU(isWebGPUSupported());

    // Check currently active theme
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const activeModel =
    AVAILABLE_MODELS.find((m) => m.id === activeModelId) || AVAILABLE_MODELS[0];

  return (
    <header className="w-full h-14 sm:h-16 border-b border-[var(--border)] bg-[var(--background)] sticky top-0 z-40 transition-colors">
      <div className="max-w-[1100px] h-full mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* LEFT: Scissors Icon + Product Name */}
        <div className="flex items-center gap-2.5">
          <Scissors className="w-4 h-4 text-[var(--text-primary)]" />
          <span className="font-semibold text-sm sm:text-base tracking-tight text-[var(--text-primary)]">
            RemoveBG
          </span>
          <span className="hidden sm:inline-block text-[11px] text-[var(--text-muted)] border-l border-[var(--border)] pl-2.5 ml-0.5">
            Local browser utility
          </span>
        </div>

        {/* RIGHT: Model selector + GitHub + Theme switch */}
        <div className="flex items-center gap-2">
          {/* Subtle Model Selector */}
          <div className="relative">
            <button
              onClick={() => !disabled && setModelDropdownOpen(!modelDropdownOpen)}
              disabled={disabled}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--surface)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              title="Select AI Model"
            >
              <span>{activeModel.name}</span>
              <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
            </button>

            {modelDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setModelDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-64 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] p-1 z-50 text-xs shadow-none animate-in fade-in">
                  <div className="px-2 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                    AI Model ({hasWebGPU ? 'WebGPU' : 'WebAssembly'})
                  </div>
                  {AVAILABLE_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        onSelectModel(model.id);
                        setModelDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-md flex items-center justify-between transition-colors ${
                        activeModelId === model.id
                          ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{model.name}</div>
                        <div
                          className={`text-[10px] ${
                            activeModelId === model.id
                              ? 'opacity-80'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {model.size}
                        </div>
                      </div>
                      {activeModelId === model.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* GitHub link */}
          <a
            href="https://github.com/HimanshuTamoli24/bg-remover"
            target="_blank"
            rel="noopener noreferrer"
            title="View on GitHub"
            aria-label="View on GitHub"
            className="p-2 rounded-md border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg
              className="w-3.5 h-3.5 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
          </a>

          {/* Theme switch (Sun / Moon) */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
            className="p-2 rounded-md border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

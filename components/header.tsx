'use client';

import React, { useState, useEffect } from 'react';
import { AVAILABLE_MODELS } from '@/types/image';
import { isWebGPUSupported } from '@/lib/utils';
import {
  Scissors,
  Zap,
  Cpu,
  ShieldCheck,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  activeModelId: string;
  onSelectModel: (id: string) => void;
  disabled?: boolean;
}

export function Header({ activeModelId, onSelectModel, disabled }: HeaderProps) {
  const [hasWebGPU, setHasWebGPU] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  useEffect(() => {
    setHasWebGPU(isWebGPUSupported());
  }, []);

  const activeModel =
    AVAILABLE_MODELS.find((m) => m.id === activeModelId) || AVAILABLE_MODELS[0];

  return (
    <header className="w-full border-b border-zinc-800 bg-zinc-950/70 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight text-white">
                CutoutStudio
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                Client AI
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Browser-based e-commerce background remover
            </p>
          </div>
        </div>

        {/* Right side controls: Model selector & Badges */}
        <div className="flex items-center gap-2.5">
          {/* Model Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => !disabled && setModelDropdownOpen(!modelDropdownOpen)}
              disabled={disabled}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-200 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <div className="text-left">
                <span className="font-medium">{activeModel.name}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 ml-1" />
            </button>

            {modelDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-2 z-50 animate-in fade-in">
                <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Select AI Model
                </div>
                {AVAILABLE_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onSelectModel(model.id);
                      setModelDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors flex flex-col gap-0.5 mb-1 ${
                      activeModelId === model.id
                        ? 'bg-indigo-600/15 border border-indigo-500/40 text-indigo-200'
                        : 'hover:bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-100">{model.name}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{model.size}</span>
                    </div>
                    <span className="text-[11px] text-zinc-400 leading-snug">
                      {model.tagline}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hardware acceleration badge */}
          <div
            title={
              hasWebGPU
                ? 'WebGPU hardware acceleration is active'
                : 'WebAssembly CPU execution provider is active'
            }
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300"
          >
            {hasWebGPU ? (
              <>
                <Zap className="w-3 h-3 text-amber-400" />
                <span>WebGPU</span>
              </>
            ) : (
              <>
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>WebAssembly</span>
              </>
            )}
          </div>

          {/* Privacy badge */}
          <div
            title="Images are processed 100% locally in your browser"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-400"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">No Server Upload</span>
          </div>
        </div>
      </div>
    </header>
  );
}

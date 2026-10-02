'use client';

import React from 'react';
import { QueueItem, ModelProgressEvent } from '@/types/image';
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Cpu,
  Database,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface ProcessingProgressProps {
  items: QueueItem[];
  isProcessing: boolean;
  currentItemId: string | null;
  modelProgress: ModelProgressEvent | null;
  activeDevice: 'webgpu' | 'wasm' | 'cpu';
}

export function ProcessingProgress({
  items,
  isProcessing,
  currentItemId,
  modelProgress,
  activeDevice,
}: ProcessingProgressProps) {
  const isModelDownloading =
    modelProgress && (modelProgress.status === 'downloading' || modelProgress.status === 'loading');

  if (!isProcessing && !isModelDownloading) {
    return null;
  }

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const currentItemIndex = items.findIndex((i) => i.id === currentItemId);

  return (
    <div className="w-full my-6 p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl backdrop-blur">
      {/* 1. Model Download Banner (First-time load) */}
      {isModelDownloading && (
        <div className="mb-4 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
              <h4 className="text-sm font-semibold text-zinc-100">
                Preparing background remover...
              </h4>
            </div>
            <span className="text-xs font-mono font-medium text-indigo-400">
              {modelProgress.progress || 0}%
            </span>
          </div>

          <p className="text-xs text-zinc-400 mb-3">
            {modelProgress.message || 'Downloading AI model weights into browser cache...'}
          </p>

          {/* Progress bar */}
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden mb-2">
            <div
              className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${modelProgress.progress || 0}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 gap-2 mt-1">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-zinc-400" />
              <span>
                {modelProgress.loaded && modelProgress.total
                  ? `${formatBytes(modelProgress.loaded)} / ${formatBytes(modelProgress.total)}`
                  : 'Cached in browser storage'}
              </span>
            </div>
            <span className="italic text-zinc-400">
              This happens only once on this device. Subsequent runs start instantly.
            </span>
          </div>
        </div>
      )}

      {/* 2. Batch Progress Indicator */}
      {isProcessing && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-sm font-semibold text-zinc-200">
                Processing {currentItemIndex !== -1 ? currentItemIndex + 1 : completedCount} / {items.length}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono text-[11px] flex items-center gap-1">
                {activeDevice === 'webgpu' ? (
                  <>
                    <Zap className="w-3 h-3 text-amber-400" />
                    WebGPU Accelerated
                  </>
                ) : (
                  <>
                    <Cpu className="w-3 h-3 text-cyan-400" />
                    WebAssembly Engine
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Live item status list */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {items.map((item, idx) => {
              const isCurrent = item.id === currentItemId;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    isCurrent
                      ? 'bg-indigo-950/40 border border-indigo-800/50 text-indigo-200'
                      : 'bg-zinc-950/40 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-[10px] text-zinc-400 w-4">
                      #{idx + 1}
                    </span>
                    <span className="truncate max-w-[200px] sm:max-w-xs">{item.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status === 'completed' && (
                      <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                      </span>
                    )}
                    {item.status === 'processing' && (
                      <span className="flex items-center gap-1 text-indigo-400 text-[11px] font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {item.progress}%
                      </span>
                    )}
                    {item.status === 'waiting' && (
                      <span className="flex items-center gap-1 text-zinc-400 text-[11px]">
                        <Clock className="w-3.5 h-3.5" />
                        Waiting
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="flex items-center gap-1 text-red-400 text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Failed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

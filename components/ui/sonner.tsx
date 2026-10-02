"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircle2, Info, AlertTriangle, AlertCircle, Loader2 } from "lucide-react"

export function Toaster({ ...props }: ToasterProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');

    const observer = new MutationObserver(() => {
      const darkActive = document.documentElement.classList.contains('dark');
      setTheme(darkActive ? 'dark' : 'light');
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="bottom-right"
      icons={{
        success: <CheckCircle2 className="w-4 h-4 text-[var(--text-primary)]" />,
        info: <Info className="w-4 h-4 text-[var(--text-primary)]" />,
        warning: <AlertTriangle className="w-4 h-4 text-[var(--text-primary)]" />,
        error: <AlertCircle className="w-4 h-4 text-red-500" />,
        loading: <Loader2 className="w-4 h-4 animate-spin text-[var(--text-primary)]" />,
      }}
      toastOptions={{
        style: {
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-strong)',
          borderRadius: '8px',
          fontSize: '13px',
          boxShadow: 'none',
        },
      }}
      {...props}
    />
  )
}

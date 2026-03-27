'use client'

import type { ToastType } from '@/hooks/useToast'

interface Toast { id: number; message: string; type: ToastType }

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast ${t.type === 'success' ? 'toast-success' : t.type === 'error' ? 'toast-error' : ''}`}
        >
          {t.type === 'success' && '[OK] '}
          {t.type === 'error'   && '[X] '}
          {t.message}
        </div>
      ))}
    </div>
  )
}

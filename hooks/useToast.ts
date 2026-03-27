'use client'

import { useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

let _counter = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++_counter
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const success = useCallback((msg: string) => push(msg, 'success'), [push])
  const error   = useCallback((msg: string) => push(msg, 'error'),   [push])

  return { toasts, push, success, error }
}

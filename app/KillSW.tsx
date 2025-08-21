'use client'
import { useEffect } from 'react'
export default function KillSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => regs.forEach(r => r.unregister()))
        .catch(() => {})
    }
  }, [])
  return null
}

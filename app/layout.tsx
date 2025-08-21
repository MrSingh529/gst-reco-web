import type { Metadata } from 'next'
import './globals.css'
import KillSW from '../components/KillSW'

export const metadata: Metadata = {
  title: 'GST Reconciliation | RV Solutions',
  description: 'Client-only GST reconciliation tool by RV Solutions',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900">
        <KillSW />
        <div className="flex min-h-screen flex-col">
          <header className="border-b bg-white/70 backdrop-blur">
            <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center text-sm font-bold">RV</div>
                <div>
                  <div className="text-lg font-semibold leading-5">GST Reconciliation</div>
                  <div className="text-[11px] text-slate-500">RV-Side • Privacy-Safe</div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="mt-12 border-t bg-white/70 backdrop-blur">
            <div className="mx-auto max-w-5xl px-6 py-4 text-sm flex items-center justify-between">
              <span className="font-medium">RV Solutions</span>
              <div className="text-right text-slate-600">
                <div>Embrace Automation</div>
                <div>Project Initiated by Vandana Ma'am</div>
                <div>Project Led by Harpinder Singh</div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}

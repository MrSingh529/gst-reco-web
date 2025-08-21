export const dynamic = 'force-static'

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">You’re offline</h1>
      <p className="mt-2 text-sm text-slate-600">
        Please check your internet connection. Some features may be unavailable.
      </p>
    </main>
  )
}

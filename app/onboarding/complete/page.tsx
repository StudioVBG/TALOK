'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingCompletePage() {
  const router = useRouter()
  const supabase = createClient()
  const [countdown, setCountdown] = useState(4)
  const [destination, setDestination] = useState('/owner/dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (!session) return
      supabase.from('profiles').select('role').eq('id', session.user.id).single().then(({ data }: any) => {
        const dest = data?.role === 'tenant' ? '/tenant/dashboard' : '/owner/dashboard'
        setDestination(dest)
        const timer = setInterval(() => {
          setCountdown((c) => { if (c <= 1) { clearInterval(timer); router.push(dest); return 0 } return c - 1 })
        }, 1000)
      })
    })
  }, [supabase, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex gap-2 mb-8">
          {['Téléphone', 'Profil', 'Identité', 'Terminé'].map((label) => (
            <div key={label} className="flex-1">
              <div className="h-1 rounded-full bg-green-500" />
              <p className="text-xs mt-1 text-green-600 font-medium">{label}</p>
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm text-center">
          <div className="w-16 h-16 bg-green-50 dark:bg-green-950 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-9 h-9 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Identité vérifiée !</h1>
          <p className="text-muted-foreground mb-6">Votre compte est maintenant pleinement actif. Vous avez accès à toutes les fonctionnalités Talok.</p>
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-sm text-green-800 dark:text-green-300 mb-6">
            Redirection dans <strong>{countdown} secondes…</strong>
          </div>
          <button onClick={() => router.push(destination)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors">
            Accéder à mon espace maintenant
          </button>
        </div>
      </div>
    </div>
  )
}

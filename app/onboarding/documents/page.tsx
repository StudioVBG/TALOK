'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Side = 'recto' | 'verso'
interface UploadState { file: File | null; preview: string | null; status: 'idle' | 'uploading' | 'done' | 'error'; error?: string }

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024

export default function OnboardingDocumentsPage() {
  const router = useRouter()
  const [recto, setRecto] = useState<UploadState>({ file: null, preview: null, status: 'idle' })
  const [verso, setVerso] = useState<UploadState>({ file: null, preview: null, status: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const rectoRef = useRef<HTMLInputElement>(null)
  const versoRef = useRef<HTMLInputElement>(null)

  const setSlot = useCallback((side: Side, updater: (prev: UploadState) => UploadState) => {
    if (side === 'recto') setRecto(updater)
    else setVerso(updater)
  }, [])

  const handleFile = (side: Side, file: File) => {
    if (!ACCEPTED.includes(file.type)) { setSlot(side, (p) => ({ ...p, status: 'error', error: 'Format non accepté (JPEG, PNG, WEBP, HEIC, PDF)' })); return }
    if (file.size > MAX_SIZE) { setSlot(side, (p) => ({ ...p, status: 'error', error: 'Fichier trop lourd (max 10 Mo)' })); return }
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setSlot(side, () => ({ file, preview, status: 'idle' }))
  }

  const uploadSide = async (side: Side, state: UploadState): Promise<boolean> => {
    if (!state.file) return false
    setSlot(side, (p) => ({ ...p, status: 'uploading', error: undefined }))
    try {
      const form = new FormData()
      form.append('file', state.file)
      form.append('type', side === 'recto' ? 'cni_recto' : 'cni_verso')
      if (side === 'recto') form.append('trigger_ocr', 'true')
      const res = await fetch('/api/documents/upload', { method: 'POST', body: form })
      if (!res.ok) { const d = await res.json(); setSlot(side, (p) => ({ ...p, status: 'error', error: d.error ?? 'Erreur upload' })); return false }
      setSlot(side, (p) => ({ ...p, status: 'done' }))
      return true
    } catch { setSlot(side, (p) => ({ ...p, status: 'error', error: 'Erreur réseau.' })); return false }
  }

  const handleSubmit = async () => {
    setGlobalError('')
    if (!recto.file) { setGlobalError('La face recto est obligatoire.'); return }
    if (!verso.file) { setGlobalError('La face verso est obligatoire.'); return }
    setSubmitting(true)
    const [okRecto, okVerso] = await Promise.all([uploadSide('recto', recto), uploadSide('verso', verso)])
    if (okRecto && okVerso) router.push('/onboarding/pending')
    setSubmitting(false)
  }

  const UploadZone = ({ side, state }: { side: Side; state: UploadState }) => {
    const ref = side === 'recto' ? rectoRef : versoRef
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{side === 'recto' ? 'Recto (face avec photo)' : 'Verso (face avec adresse)'}</p>
        <div onClick={() => ref.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(side, f) }}
          className={`relative cursor-pointer border-2 border-dashed rounded-xl p-6 transition-colors ${
            state.status === 'done' ? 'border-green-400 bg-green-50 dark:bg-green-950'
            : state.status === 'error' ? 'border-red-400 bg-red-50 dark:bg-red-950'
            : 'border-border hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950'}`}>
          <input ref={ref} type="file" accept={ACCEPTED.join(',')} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(side, f) }} />
          {state.status === 'uploading' ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Upload en cours…</p>
            </div>
          ) : state.file ? (
            <div className="flex items-center gap-3">
              {state.preview
                ? <img src={state.preview} alt={side} className="w-20 h-14 object-cover rounded-lg border border-border" />
                : <div className="w-20 h-14 bg-muted rounded-lg flex items-center justify-center">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>}
              <div>
                <p className={`text-sm font-medium ${state.status === 'done' ? 'text-green-700 dark:text-green-300' : 'text-foreground'}`}>
                  {state.status === 'done' ? 'Importé ✓' : state.file.name}
                </p>
                <p className="text-xs text-muted-foreground">{(state.file.size / 1024).toFixed(0)} Ko</p>
                <button onClick={(e) => { e.stopPropagation(); setSlot(side, () => ({ file: null, preview: null, status: 'idle' })) }}
                  className="text-xs text-blue-600 hover:underline mt-0.5">Changer</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-medium text-foreground">Déposer ou cliquer pour importer</p>
              <p className="text-xs text-muted-foreground">JPEG, PNG, WEBP, HEIC ou PDF — max 10 Mo</p>
            </div>
          )}
        </div>
        {state.status === 'error' && <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex gap-2 mb-8">
          {['Téléphone', 'Profil', 'Identité', 'Terminé'].map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1 rounded-full ${i <= 2 ? 'bg-blue-600' : 'bg-muted'}`} />
              <p className={`text-xs mt-1 ${i <= 2 ? 'text-blue-600 font-medium' : 'text-muted-foreground'}`}>{label}</p>
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950 rounded-xl flex items-center justify-center mb-6">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Pièce d'identité</h1>
          <p className="text-muted-foreground mb-6">Importez les deux faces de votre carte nationale d'identité ou passeport.</p>
          <div className="space-y-5 mb-6">
            <UploadZone side="recto" state={recto} />
            <UploadZone side="verso" state={verso} />
          </div>
          {globalError && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm mb-4">{globalError}</div>}
          <button onClick={handleSubmit} disabled={submitting || !recto.file || !verso.file}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
            {submitting ? 'Envoi en cours…' : 'Envoyer pour vérification'}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">Vos documents sont chiffrés et stockés en France.</p>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { createClient } from '../lib/supabase/client'

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    const { error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    setLoading(false)
    if (error) { setError(error.message); return }

    if (mode === 'signup') {
      setError('Check your email to confirm your account, then sign in.')
      setMode('signin')
      return
    }

    window.location.href = '/'
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 px-6 py-8">
        <h1 className="text-sm font-semibold text-gray-900 mb-1">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h1>
        <p className="text-xs text-gray-400 mb-5">SEO Agent dashboard</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors">
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError('') }}
          className="mt-4 text-xs text-blue-500 hover:underline">
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

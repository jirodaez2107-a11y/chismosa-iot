import { useEffect, useState } from 'react'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth, firebaseConfigured } from '../firebase'
import { saveUserProfile } from '../data/firestore'

function toProfile(user) {
  if (!user) return null
  return { uid: user.uid, name: user.displayName || user.email?.split('@')[0] || 'ChismOSA User', email: user.email || '', emailVerified: user.emailVerified }
}

function mapLoginError(authError) {
  const error = new Error(authError.message)
  error.code = authError.code
  if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
    error.message = 'Password incorrect'
  } else if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-email') {
    error.message = 'Account not found: the email cannot be found in Firebase'
  }
  return error
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false)
      return undefined
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser?.emailVerified ? toProfile(nextUser) : null)
      setLoading(false)
      if (nextUser?.emailVerified) saveUserProfile(nextUser).catch(() => {})
    })
  }, [])

  const login = async ({ email, password, remember }) => {
    setError('')
    if (!firebaseConfigured) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to client/.env.local.')
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
      const result = await signInWithEmailAndPassword(auth, email, password)
      if (!result.user.emailVerified) {
        await sendEmailVerification(result.user)
        await signOut(auth)
        const verificationError = new Error('Please verify your email before accessing ChismOSA. A new verification link has been sent.')
        verificationError.code = 'auth/email-not-verified'
        throw verificationError
      }
      return toProfile(result.user)
    } catch (authError) {
      throw mapLoginError(authError)
    }
  }

  const signup = async ({ name, email, password, remember }) => {
    setError('')
    if (!firebaseConfigured) throw new Error('Firebase is not configured. Add VITE_FIREBASE_* values to client/.env.local.')
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
      const result = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(result.user, { displayName: name })
      await sendEmailVerification(result.user)
      await signOut(auth)
      return { uid: result.user.uid, name, email, verificationRequired: true }
    } catch (authError) {
      throw authError
    }
  }

  const logout = () => signOut(auth).catch((authError) => setError(authError.message))
  return { user, loading, error, setError, login, signup, logout, isAuthenticated: Boolean(user) }
}

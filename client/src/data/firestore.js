import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, firebaseConfigured } from '../firebase'

export function subscribeToUserSettings(userId, onSettings, onError) {
  if (!firebaseConfigured || !userId) return () => {}
  return onSnapshot(doc(db, 'users', userId, 'settings', 'chismosa'), (snapshot) => {
    onSettings(snapshot.exists() ? snapshot.data() : {})
  }, onError)
}

export async function saveUserProfile(user) {
  if (!firebaseConfigured || !user) return
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function saveUserSettings(userId, settings) {
  if (!firebaseConfigured || !userId) return
  await setDoc(doc(db, 'users', userId, 'settings', 'chismosa'), {
    ...settings,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

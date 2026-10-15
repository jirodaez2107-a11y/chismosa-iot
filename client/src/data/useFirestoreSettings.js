import { useEffect, useRef } from 'react'
import { saveUserSettings, subscribeToUserSettings } from './firestore'

export function useFirestoreSettings(user, streams, setStreams, widgets, setWidgets) {
  const loadedRef = useRef(false)
  const userId = user?.uid

  useEffect(() => {
    loadedRef.current = false
    if (!userId) return undefined
    const unsubscribe = subscribeToUserSettings(userId, (settings) => {
      if (Array.isArray(settings.streams)) setStreams(settings.streams)
      if (Array.isArray(settings.widgets)) setWidgets(settings.widgets)
      loadedRef.current = true
    }, (error) => console.warn('Firestore settings subscription failed:', error.message))
    return () => unsubscribe()
  }, [userId, setStreams, setWidgets])

  useEffect(() => {
    if (!userId || !loadedRef.current) return undefined
    const timer = setTimeout(() => {
      saveUserSettings(userId, { streams, widgets }).catch((error) => console.warn('Firestore settings save failed:', error.message))
    }, 350)
    return () => clearTimeout(timer)
  }, [userId, streams, widgets])
}

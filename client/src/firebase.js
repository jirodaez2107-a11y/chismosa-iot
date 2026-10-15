import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCCDFISyUL07jRsEPFQMBZ9R07xmZjfz1I',
  authDomain: 'chismosa-iot.firebaseapp.com',
  projectId: 'chismosa-iot',
  storageBucket: 'chismosa-iot.firebasestorage.app',
  messagingSenderId: '945330884157',
  appId: '1:945330884157:web:bf37b85838fab9405c2454',
  measurementId: 'G-GX53R9SMMD',
}

export const firebaseConfigured = true
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export { firebaseConfig }

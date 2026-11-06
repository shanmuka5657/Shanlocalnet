import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyACX8sWQWhoW_ZnPj0GQ7SE3nZxafCCaF0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "localnet-8fe40.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "localnet-8fe40",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "localnet-8fe40.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "268165556142",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:268165556142:web:01d1b467569b94b2b28a3f"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  firebaseSignOut,
  onAuthStateChanged,
  type FirebaseUser
};


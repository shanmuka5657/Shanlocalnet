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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCRf4yzpOPwP4TajyyiR0DMP-kTmK-sPyg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studio-9503295832-7bdc9.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "studio-9503295832-7bdc9",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "studio-9503295832-7bdc9.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1037511833028",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1037511833028:web:4126c824e42726c0cde091"
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


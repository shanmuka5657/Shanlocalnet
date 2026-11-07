import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  firebaseSignOut,
  onAuthStateChanged,
  FirebaseUser
} from '../lib/firebase.ts';
import { UserProfile, UserRole, SupportedLanguage } from '../types/index.ts';
import { setCurrentUserId } from '../lib/engagementStorage.ts';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithPhone: (phoneNumber: string, name?: string) => Promise<void>;
  loginWithLocal: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (role?: UserRole, language?: SupportedLanguage) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'localnet_auth_user_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync with backend API
  const syncWithBackend = async (fUser: FirebaseUser): Promise<UserProfile | null> => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': fUser.uid
        },
        body: JSON.stringify({
          id: fUser.uid,
          email: fUser.email || `${fUser.uid}@localnet.in`,
          name: fUser.displayName || 'Local User',
          avatar: fUser.photoURL || ''
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data?.user) {
        setUser(data.user);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.user));
        return data.user;
      }
    } catch (err: any) {
      console.error('[AuthContext] Backend sync error:', err);
      // Fallback local profile if backend is slow/offline
      const fallbackProfile: UserProfile = {
        id: fUser.uid,
        name: fUser.displayName || 'Google User',
        handle: `@${(fUser.displayName || 'user').toLowerCase().replace(/\s+/g, '_')}_${fUser.uid.slice(0, 4)}`,
        avatar: fUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        phone: fUser.phoneNumber || '',
        email: fUser.email || '',
        city: 'Kurnool',
        state: 'Andhra Pradesh',
        country: 'India',
        bio: 'LocalNet verified Google explorer',
        roles: ['viewer'],
        activeRole: 'viewer',
        language: 'en',
        verified: true,
        followersCount: 0,
        followingCount: 0,
        savedPostIds: [],
        joinedCommunityIds: ['comm_kurnool_city']
      };
      setUser(fallbackProfile);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fallbackProfile));
      return fallbackProfile;
    }
    return null;
  };

  useEffect(() => {
    // Check redirect result on load
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          setFirebaseUser(result.user);
          await syncWithBackend(result.user);
        }
      })
      .catch((err) => {
        console.error('[AuthContext] Redirect result error:', err);
      });

    // Listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        setCurrentUserId(fUser.uid);       // ← scope all engagement data to this user
        await syncWithBackend(fUser);
      } else {
        setCurrentUserId('anonymous');     // ← reset to anonymous on logout
        setUser(null);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      // First attempt popup sign-in
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred?.user) {
        setFirebaseUser(cred.user);
        await syncWithBackend(cred.user);
      }
    } catch (err: any) {
      console.warn('[AuthContext] Popup sign-in warning/error:', err?.code, err?.message);
      if (
        err?.code === 'auth/popup-blocked' ||
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        // Fallback to redirect sign-in
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          setError(redirectErr?.message || 'Failed to redirect to Google sign in');
        }
      } else {
        setError(err?.message || 'Google sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const loginWithPhone = async (phoneNumber: string, name: string = 'Kurnool Local') => {
    setError(null);
    setLoading(true);
    try {
      const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
      const phoneSuffix = cleanPhone.slice(-4) || 'local';
      const phoneUserId = `phone_${cleanPhone.replace(/[^0-9]/g, '') || Date.now()}`;
      const userProfile: UserProfile = {
        id: phoneUserId,
        name: name || 'Local Explorer',
        handle: `@user_${phoneSuffix}`,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${phoneUserId}`,
        phone: cleanPhone.startsWith('+') ? cleanPhone : `+91 ${cleanPhone}`,
        email: `${phoneUserId}@localnet.in`,
        city: 'Kurnool',
        state: 'Andhra Pradesh',
        country: 'India',
        bio: 'Verified LocalNet citizen',
        roles: ['viewer'],
        activeRole: 'viewer',
        language: 'en',
        verified: true,
        followersCount: 0,
        followingCount: 0,
        savedPostIds: [],
        joinedCommunityIds: ['comm_kurnool_city']
      };

      setUser(userProfile);
      setCurrentUserId(userProfile.id);   // ← scope engagement data to phone user
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userProfile));

      // Sync with Postgres database
      try {
        await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': phoneUserId },
          body: JSON.stringify({
            id: userProfile.id,
            email: userProfile.email,
            name: userProfile.name,
            avatar: userProfile.avatar,
            language: userProfile.language
          })
        });
      } catch (syncErr) {
        console.warn('Backend sync warning:', syncErr);
      }
    } catch (err: any) {
      console.error('[AuthContext] Phone login error:', err);
      setError(err?.message || 'Phone sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const loginWithLocal = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/local-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Local login failed');
      if (data.user) {
        setCurrentUserId(data.user.id);
        setUser(data.user);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.user));
      }
    } catch (err: any) {
      setError(err.message || 'Local login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setCurrentUserId('anonymous');      // ← clear user scope on logout
      setFirebaseUser(null);
      setUser(null);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (err: any) {
      console.error('[AuthContext] Logout error:', err);
      setError(err?.message || 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (role?: UserRole, language?: SupportedLanguage) => {
    if (!user) return;
    try {
      const res = await fetch('/api/user/update-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({
          userId: user.id,
          role,
          language
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.user));
        }
      }
    } catch (err: any) {
      console.error('[AuthContext] Update role error:', err);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        error,
        loginWithGoogle,
        loginWithPhone,
        loginWithLocal,
        logout,
        updateRole,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { logout } from '../store/profile';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Dashboard from './components/Dashboard';
import { ToastProvider } from './components/ToastProvider';
import RetroLoading from '../components/player/RetroLoading';
import { resolveAdminAccess } from '../lib/adminAccess';

// Lazy-load Material Symbols font (admin-only, ~250KB)
const MATERIAL_SYMBOLS_URL = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap';
const ADMIN_CODENAME = 'gm.mpg';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean | null>(null);

  useEffect(() => {
    // Load Material Symbols font for admin panel
    if (!document.querySelector(`link[href="${MATERIAL_SYMBOLS_URL}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = MATERIAL_SYMBOLS_URL;
      document.head.appendChild(link);
    }


    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        // Execute logging updates in the background to avoid blocking the Admin UI load
        getDoc(userRef)
          .then((userSnap) => {
            if (!userSnap.exists()) {
              setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: ADMIN_CODENAME,
                role: 'admin',
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
              }).catch(err => console.warn('[AdminApp] Error creating admin user doc:', err));
            } else {
              setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true })
                .catch(err => console.warn('[AdminApp] Error updating admin login timestamp:', err));
            }
          })
          .catch((err) => {
            console.warn('[AdminApp] Error fetching admin user doc:', err);
          });

        setHasAdminAccess(await resolveAdminAccess(currentUser));
      } else {
        setHasAdminAccess(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading || hasAdminAccess === null) {
    return <RetroLoading fullScreen message="Inicializando_Protocolos..." subMessage="Acessando Terminal Administrativo RM-84" />;
  }

  if (!user || !hasAdminAccess) {
    window.location.href = '/';
    return null;
  }

  return <ToastProvider><Dashboard user={user} onLogout={logout} /></ToastProvider>;
}

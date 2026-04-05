// AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef(null);

  // Helper: fetch profile with a 10-second timeout
  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }

    // Cancel any ongoing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Profile fetch timeout after 10s')), 10000);
    });

    try {
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
      if (error) throw error;
      if (data) setProfile(data);
      return data;
    } catch (err) {
      console.error('fetchProfile error:', err.message);
      // Don't throw – we don't want to crash the UI. Just log and keep old profile.
      return null;
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false); // ✅ FIX: always set loading false
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return;
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ... rest of auth methods (signInWithGoogle, etc.) unchanged
  const signInWithGoogle = async () => { /* ... */ };
  const signInWithTwitter = async () => { /* ... */ };
  const signInWithEmail = async (email, password) => { /* ... */ };
  const signUpWithEmail = async (email, password, displayName = 'New User') => { /* ... */ };
  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signInWithGoogle,
      signInWithTwitter,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      fetchProfile: () => fetchProfile(user?.id) // ✅ now safe
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
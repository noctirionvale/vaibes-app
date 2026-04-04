import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // ✅ NEW: Store the user's profile data
  const [loading, setLoading] = useState(true);

  // ✅ NEW: Function to pull the profile data from the database
  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) setProfile(data);
    if (error) console.error("Error fetching profile:", error.message);
  };

  useEffect(() => {
    // 1. We wrap everything in an async function to control the exact execution order
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    };

    // Run the initial check
    initializeAuth();

    // 2. Set up the listener for FUTURE changes, ignoring the initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // ✅ THIS IS THE MAGIC FIX: Ignore the initial event to prevent the token collision
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

    // Cleanup the listener when the component unmounts
    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://vaibes.pro/app'
      }
    });
  };

  const signInWithTwitter = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'twitter',
      options: {
        redirectTo: 'https://vaibes.pro/app'
      }
    });
  };

  const signInWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  // ✅ UPDATED: Now passes the display name into the metadata so the trigger can catch it
  const signUpWithEmail = async (email, password, displayName = 'New User') => {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: { display_name: displayName }
      }
    });
    
    if (error) throw error;
    
    // ✅ NEW: Return the data so our UI knows what to do next
    return data; 
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null); // Clear out the profile state
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
      fetchProfile: () => fetchProfile(user?.id) // ✅ Added
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
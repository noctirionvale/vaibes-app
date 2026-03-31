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
    // Handle initial load / OAuth redirect
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id); // Fetch profile if already logged in
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes (logging in/out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id); // Fetch profile on fresh login
        } else {
          setProfile(null); // Clear profile on logout
        }
        setLoading(false);
      }
    );

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
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: { display_name: displayName }
      }
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null); // Clear out the profile state
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile, // ✅ Export the profile so the rest of vAIbes can read the plan/stats
      loading,
      signInWithGoogle,
      signInWithTwitter,
      signInWithEmail,
      signUpWithEmail,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
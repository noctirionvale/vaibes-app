import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({});

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('vaibes_theme');
    return saved ? saved === 'dark' : true; // dark by default
  });

  useEffect(() => {
    if (isDark) {
      document.body.classList.remove('light-mode');
      localStorage.setItem('vaibes_theme', 'dark');
    } else {
      document.body.classList.add('light-mode');
      localStorage.setItem('vaibes_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
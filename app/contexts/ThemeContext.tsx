import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

import {
  DARK_COLORS,
  LIGHT_COLORS,
} from '@/constants/colors';

type ThemeContextType = {
  isDark: boolean;
  colors: typeof DARK_COLORS | typeof LIGHT_COLORS;
  toggleTheme: () => void;
  setIsDark: (value: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isDark, setIsDark] = useState(true);

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const toggleTheme = () => {
    setIsDark((previous) => !previous);
  };

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        colors,
        toggleTheme,
        setIsDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useTheme must be used inside ThemeProvider'
    );
  }

  return context;
}

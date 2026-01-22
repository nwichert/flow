import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeColor = 'pink' | 'blue' | 'green';

interface ColorPalette {
  primary: string;      // Main color (buttons, accents)
  primaryHover: string; // Hover state
  primaryLight: string; // Light variant (backgrounds, badges)
  primaryMuted: string; // Muted variant (secondary elements)
  primaryFaded: string; // Very light (selection backgrounds)
}

const palettes: Record<ThemeColor, ColorPalette> = {
  pink: {
    primary: '#ff0071',
    primaryHover: '#e00065',
    primaryLight: '#ff69b4',
    primaryMuted: '#ffb6c1',
    primaryFaded: 'rgba(255, 0, 113, 0.2)',
  },
  blue: {
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    primaryLight: '#60a5fa',
    primaryMuted: '#93c5fd',
    primaryFaded: 'rgba(59, 130, 246, 0.2)',
  },
  green: {
    primary: '#10b981',
    primaryHover: '#059669',
    primaryLight: '#34d399',
    primaryMuted: '#6ee7b7',
    primaryFaded: 'rgba(16, 185, 129, 0.2)',
  },
};

interface ThemeContextType {
  theme: ThemeColor;
  setTheme: (theme: ThemeColor) => void;
  colors: ColorPalette;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeColor>(() => {
    const saved = localStorage.getItem('app-theme');
    return (saved as ThemeColor) || 'pink';
  });

  useEffect(() => {
    localStorage.setItem('app-theme', theme);

    // Update CSS variables for global access
    const root = document.documentElement;
    const colors = palettes[theme];
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-primary-hover', colors.primaryHover);
    root.style.setProperty('--color-primary-light', colors.primaryLight);
    root.style.setProperty('--color-primary-muted', colors.primaryMuted);
    root.style.setProperty('--color-primary-faded', colors.primaryFaded);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors: palettes[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Helper component for themed elements
export function ThemedButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline'
}) {
  const { colors } = useTheme();

  const baseStyles = variant === 'primary'
    ? { backgroundColor: colors.primary }
    : { borderColor: colors.primary, color: colors.primary };

  return (
    <button
      className={className}
      style={baseStyles}
      {...props}
    >
      {children}
    </button>
  );
}

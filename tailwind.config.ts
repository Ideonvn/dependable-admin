import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Dependable brand colors
        primary: {
          DEFAULT: '#1A1A6D',
          dark: '#20B2AA',
          80: 'rgba(26, 26, 109, 0.8)',
          'dark-80': 'rgba(32, 178, 170, 0.8)',
        },
        secondary: {
          DEFAULT: 'rgba(135, 206, 250, 1)',
          dark: 'rgba(70, 130, 180, 1)',
          50: 'rgba(135, 206, 250, 0.5)',
          75: 'rgba(135, 206, 250, 0.75)',
          80: 'rgba(135, 206, 250, 0.8)',
          90: 'rgba(135, 206, 250, 0.9)',
          'dark-50': 'rgba(70, 130, 180, 0.5)',
          'dark-75': 'rgba(70, 130, 180, 0.75)',
          'dark-80': 'rgba(70, 130, 180, 0.8)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

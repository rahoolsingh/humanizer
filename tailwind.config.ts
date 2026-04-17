import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class', // Enables dark mode toggling based on a CSS class
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      keyframes: {
        slideIn: {
            '0%': { opacity: "0", transform: 'translateX(100%)' },
            '100%': { opacity: "1", transform: 'translateX(0)' },
        },
        fadeOut: {
            '0%': { opacity: "1", transform: 'translateY(0)' },
            '100%': { opacity: "0", transform: 'translateY(10px)' },
        },
        float: {
            '0%, 100%': { transform: 'translateY(0)' },
            '50%': { transform: 'translateY(-4px)' }
        }
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'fade-out': 'fadeOut 0.3s ease-in forwards',
        'float': 'float 3s ease-in-out infinite',
        'float-fast': 'float 1.5s ease-in-out infinite',
      }
    },
  },
  plugins: [],
};

export default config;
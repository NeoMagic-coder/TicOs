import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--text-primary)",
        surface: "var(--surface)",
        border: "var(--border)",
        primary: {
          DEFAULT: "var(--primary)",
          light: "var(--primary-light)",
          dark: "var(--primary-dark)",
        },
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
        "automation-pink": "var(--automation-pink)",
        "automation-mint": "var(--automation-mint)",
        "automation-blue": "var(--automation-blue)",
        "automation-orange": "var(--automation-orange)",
        "automation-yellow": "var(--automation-yellow)",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.1)",
        sidebar: "2px 0 8px rgba(0,0,0,0.06)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      width: {
        sidebar: "var(--sidebar-width)",
        "sidebar-collapsed": "var(--sidebar-collapsed)",
      },
    },
  },
  plugins: [],
};

export default config;

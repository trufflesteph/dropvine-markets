import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        stone: {
          50: "#FAFAF7", 100: "#F2F0EA", 200: "#E8E5DE", 300: "#D5D1C7",
          400: "#A8A398", 500: "#75716A", 600: "#56534D", 700: "#3D3B36",
          800: "#26241F", 900: "#0E0E0C",
        },
        olive: "#2D4A2A",
      },
      borderRadius: {
        lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
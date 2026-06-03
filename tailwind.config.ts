import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#1A2B4A", light: "#2A4B7A", dark: "#0D1A2D" },
        accent: { DEFAULT: "#E85D24", light: "#F27A48" },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;

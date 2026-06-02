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
        brand: { DEFAULT: "#1A3A5C", light: "#2A5A8C", dark: "#0D1F2D" },
        accent: { DEFAULT: "#E85D24", light: "#F27A48" },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    // Palet ditutup total (bukan extend) supaya warna default Tailwind
    // (blue-500, indigo-600, dst.) tidak bisa kepakai tanpa sengaja —
    // semua warna harus lewat token semantik di bawah.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: "#000000",
      navy: {
        DEFAULT: "#0f1f3d",
        600: "#1a3164",
      },
      gold: {
        DEFAULT: "#b8892b",
        light: "#e9c877",
      },
      success: "#1f8a56",
      danger: "#c0392b",
      neutral: {
        bg: "#f6f5f2",
        border: "#e4e0d6",
        50: "#f9f9f8",
        100: "#f1efe9",
        400: "#9aa1ac",
        500: "#6b7280",
        700: "#3f4657",
        900: "#1c2230",
      },
    },
    extend: {},
  },
  plugins: [],
};

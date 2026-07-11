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
      violet: {
        DEFAULT: "#6f55f2",
        light: "#efeaff",
      },
      coral: {
        DEFAULT: "#ff4b4b",
        light: "#fff0ef",
      },
      mint: {
        DEFAULT: "#18c594",
        light: "#e9fbf5",
      },
      success: "#1f8a56",
      danger: "#c0392b",
      neutral: {
        bg: "#f6fbff",
        border: "#dfe8f1",
        50: "#f9f9f8",
        100: "#edf2f7",
        400: "#9aa1ac",
        500: "#6b7280",
        700: "#3f4657",
        900: "#1c2230",
      },
    },
    extend: {
      boxShadow: {
        gloss: "0 20px 55px rgba(49, 77, 119, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.82)",
        soft: "0 12px 30px rgba(49, 77, 119, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.74)",
        float: "0 20px 42px rgba(111, 85, 242, 0.34)"
      }
    },
  },
  plugins: [],
};

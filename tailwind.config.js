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
      },
      keyframes: {
        "bell-ring": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "10%": { transform: "rotate(14deg)" },
          "20%": { transform: "rotate(-12deg)" },
          "30%": { transform: "rotate(10deg)" },
          "40%": { transform: "rotate(-8deg)" },
          "50%": { transform: "rotate(6deg)" },
          "60%": { transform: "rotate(-4deg)" },
          "70%, 100%": { transform: "rotate(0deg)" }
        },
        "auth-fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "auth-slide-up": {
          "0%": { opacity: "0", transform: "translateY(18px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" }
        },
        "auth-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" }
        }
      },
      animation: {
        "bell-ring": "bell-ring 0.6s ease-in-out 3",
        "auth-fade-up": "auth-fade-up 0.45s ease-out both",
        "auth-slide-up": "auth-slide-up 0.5s ease-out both",
        "auth-float": "auth-float 5s ease-in-out infinite"
      }
    },
  },
  plugins: [],
};

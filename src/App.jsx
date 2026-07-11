// src/App.jsx
// Placeholder scaffold — routing & halaman sungguhan dibangun di Step 2-4.
// Sengaja tanpa react-router-dom: 4 layar (auth/onboarding/dashboard/account)
// cukup pakai state view switching seperti pola lama di Alpine, tanpa
// menambah bobot bundle & konfigurasi SPA-fallback di Nginx.

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-bg px-6">
      <div className="rounded-lg bg-navy px-4 py-2 text-white text-sm font-semibold shadow">
        Keuangan Keluarga — scaffold React + Tailwind siap
      </div>
    </div>
  );
}

// src/pages/PaymentStatusPage.jsx
// Halaman full-screen yang ditampilkan sesaat setelah redirect balik dari
// Midtrans (?order_id=...), selama status pembayaran di-poll (lihat
// hooks/usePaymentStatus.js). Menggantikan banner inline yang sebelumnya
// nempel di AccountPage supaya progresnya jelas terlihat sebagai satu layar,
// bukan tersembunyi di antara pengaturan akun lain.

import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export default function PaymentStatusPage({ polling, statusMsg, onDone }) {
  const isPaid = statusMsg.includes("berhasil");
  const isFailed = statusMsg.includes("gagal");

  return (
    <div className="max-w-lg mx-auto px-5 pt-16 pb-28 flex flex-col items-center text-center">
      <div className="gloss-panel w-full rounded-3xl p-8 flex flex-col items-center gap-4">
        {polling && <Loader2 size={40} className="animate-spin text-violet" />}
        {!polling && isPaid && <CheckCircle2 size={40} className="text-mint" />}
        {!polling && isFailed && <XCircle size={40} className="text-coral" />}

        <div className="text-sm font-semibold text-navy">
          {statusMsg || "Memeriksa status pembayaran..."}
        </div>

        {!polling && (
          <button
            type="button"
            onClick={onDone}
            className="min-h-[44px] px-6 rounded-full bg-navy text-white text-sm font-bold"
          >
            Ke Halaman Akun
          </button>
        )}
      </div>
    </div>
  );
}

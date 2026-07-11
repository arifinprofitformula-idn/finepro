import { useState, useCallback } from "react";
import { getPaymentStatus } from "../api/payments.js";

export function usePaymentStatus() {
  const [polling, setPolling] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Dipanggil saat balik dari halaman pembayaran Midtrans. Webhook Midtrans
  // biasanya masuk beberapa detik setelah bayar, jadi di-poll, bukan sekali cek.
  const poll = useCallback(async (orderId, onPaid) => {
    setPolling(true);
    setStatusMsg("Memeriksa status pembayaran...");

    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const payment = await getPaymentStatus(orderId);
        if (payment.status === "paid") {
          setStatusMsg("Pembayaran berhasil! Langganan Anda sudah aktif.");
          setPolling(false);
          if (onPaid) await onPaid();
          return;
        }
        if (payment.status === "failed") {
          setStatusMsg("Pembayaran gagal atau dibatalkan.");
          setPolling(false);
          return;
        }
      } catch {
        // lanjut coba lagi
      }
      await new Promise((r) => setTimeout(r, 3000));
    }

    setPolling(false);
    setStatusMsg("Status pembayaran belum diketahui. Cek kembali beberapa saat lagi.");
  }, []);

  return { polling, statusMsg, poll };
}

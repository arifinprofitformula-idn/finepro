// src/components/MonthlyChart.jsx
// Grafik bulanan: bar Masuk/Keluar per bulan (Jan-Des tahun berjalan) —
// sama pola dengan CategoryChart.jsx (functional component, data pre-agregasi via props).

import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default function MonthlyChart({ data, loading }) {
  if (loading) {
    return (
      <div className="h-56 flex items-center justify-center text-sm font-semibold text-neutral-500">
        Memuat data tahun ini...
      </div>
    );
  }

  const hasData = data.some((m) => m.income > 0 || m.expense > 0);
  if (!hasData) {
    return (
      <div className="h-56 flex items-center justify-center text-sm font-semibold text-neutral-500">
        Belum ada transaksi tahun ini
      </div>
    );
  }

  return (
    <div className="h-56">
      <Bar
        data={{
          labels: MONTH_LABELS,
          datasets: [
            { label: "Masuk", data: data.map((m) => m.income), backgroundColor: "#18c594", borderRadius: 3 },
            { label: "Keluar", data: data.map((m) => m.expense), backgroundColor: "#ff4b4b", borderRadius: 3 }
          ]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: { boxWidth: 10, usePointStyle: true, pointStyle: "circle", padding: 14, font: { size: 11, weight: "700" }, color: "#1c2230" }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9aa1ac" } },
            y: {
              beginAtZero: true,
              grid: { color: "rgba(0,0,0,0.05)" },
              ticks: { font: { size: 10 }, color: "#9aa1ac", callback: (v) => "Rp " + Math.round(v / 1000) + "k" }
            }
          }
        }}
      />
    </div>
  );
}

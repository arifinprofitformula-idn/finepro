// src/components/DailyChart.jsx
// Grafik harian: bar Masuk/Keluar + line Saldo (kumulatif), dua sumbu-Y —
// sama pola dengan CategoryChart.jsx (functional component, data pre-agregasi via props).

import {
  Chart as ChartJS,
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from "chart.js";
import { Chart } from "react-chartjs-2";

// BarController & LineController wajib didaftarkan manual di sini —
// beda dari MonthlyChart.jsx/CategoryChart.jsx yang pakai komponen typed
// react-chartjs-2 (<Bar>/<Doughnut>, auto-registrasi controller-nya sendiri),
// komponen <Chart> generik di bawah ini dipakai justru karena butuh mixed
// dataset (bar + line dalam satu chart) sehingga tidak auto ter-registrasi.
ChartJS.register(BarController, LineController, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function DailyChart({ data }) {
  const { labels, masuk, keluar, saldo } = data;

  if (labels.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm font-semibold text-neutral-500">
        Belum ada transaksi bulan ini
      </div>
    );
  }

  return (
    <div className="h-56">
      <Chart
        type="bar"
        data={{
          labels,
          datasets: [
            { type: "bar", label: "Masuk", data: masuk, backgroundColor: "#18c594", borderRadius: 3, yAxisID: "y", order: 2 },
            { type: "bar", label: "Keluar", data: keluar, backgroundColor: "#ff4b4b", borderRadius: 3, yAxisID: "y", order: 2 },
            {
              type: "line",
              label: "Saldo",
              data: saldo,
              borderColor: "#19a7ce",
              backgroundColor: "#19a7ce",
              pointRadius: 3,
              pointBackgroundColor: "#19a7ce",
              tension: 0.3,
              yAxisID: "y1",
              order: 1
            }
          ]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              position: "top",
              labels: { boxWidth: 10, usePointStyle: true, pointStyle: "circle", padding: 14, font: { size: 11, weight: "700" }, color: "#1c2230" }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#9aa1ac" } },
            y: {
              position: "left",
              beginAtZero: true,
              grid: { color: "rgba(0,0,0,0.05)" },
              ticks: { font: { size: 10 }, color: "#9aa1ac", callback: (v) => "Rp " + Math.round(v / 1000) + "k" }
            },
            y1: {
              position: "right",
              beginAtZero: true,
              grid: { display: false },
              ticks: { font: { size: 10 }, color: "#9aa1ac", callback: (v) => "Rp " + Math.round(v / 1000) + "k" }
            }
          }
        }}
      />
    </div>
  );
}

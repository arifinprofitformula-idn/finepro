// src/components/DailyChart.jsx
// Grafik harian: line Saldo (kumulatif), tanpa bar Masuk/Keluar.
// sama pola dengan CategoryChart.jsx (functional component, data pre-agregasi via props).

import {
  Chart as ChartJS,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function DailyChart({ data }) {
  const { labels, saldo } = data;

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
        type="line"
        data={{
          labels,
          datasets: [
            {
              type: "line",
              label: "Saldo",
              data: saldo,
              borderColor: "#6f55f2",
              backgroundColor: "rgba(111, 85, 242, 0.14)",
              fill: true,
              borderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: "#ffffff",
              pointBorderColor: "#6f55f2",
              pointBorderWidth: 2,
              tension: 0.3,
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

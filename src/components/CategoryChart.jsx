// src/components/CategoryChart.jsx
// Ganti dari manipulasi canvas langsung (versi Alpine, src/components/categoryChart.js)
// ke react-chartjs-2 — palet & tipe chart (doughnut) dipertahankan persis.

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const PALETTE = ["#0f1f3d", "#b8892b", "#1f8a56", "#c0392b", "#5b6ee1", "#e9c877", "#8e6c34", "#6b7280", "#4a90a4"];

export default function CategoryChart({ byCategory }) {
  const labels = Object.keys(byCategory);
  const data = Object.values(byCategory);

  if (labels.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-neutral-500">
        Belum ada pengeluaran bulan ini
      </div>
    );
  }

  return (
    <div className="h-48">
      <Doughnut
        data={{
          labels,
          datasets: [{ data, backgroundColor: PALETTE, borderColor: "#ffffff", borderWidth: 2 }]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 10, font: { size: 10 }, color: "#1c2230" }
            }
          }
        }}
      />
    </div>
  );
}

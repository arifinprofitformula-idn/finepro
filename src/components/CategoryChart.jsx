// src/components/CategoryChart.jsx
// Ganti dari manipulasi canvas langsung (versi Alpine, src/components/categoryChart.js)
// ke react-chartjs-2 — palet & tipe chart (doughnut) dipertahankan persis.

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const PALETTE = ["#6f55f2", "#18c594", "#ff4b4b", "#f5b82e", "#19a7ce", "#0f1f3d", "#e9c877", "#9aa1ac", "#ff8a65"];

export default function CategoryChart({ byCategory }) {
  const labels = Object.keys(byCategory);
  const data = Object.values(byCategory);

  if (labels.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm font-semibold text-neutral-500">
        Belum ada pengeluaran bulan ini
      </div>
    );
  }

  return (
    <div className="h-56">
      <Doughnut
        data={{
          labels,
          datasets: [{ data, backgroundColor: PALETTE, borderColor: "rgba(255,255,255,0.92)", borderWidth: 4, hoverOffset: 6 }]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "66%",
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 10, usePointStyle: true, pointStyle: "circle", padding: 14, font: { size: 11, weight: "700" }, color: "#1c2230" }
            }
          }
        }}
      />
    </div>
  );
}

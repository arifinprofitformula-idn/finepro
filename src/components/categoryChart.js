// src/components/categoryChart.js
// Komponen chart donat pengeluaran per kategori. Dipanggil ulang setiap
// dashboard di-refresh; instance lama di-destroy dulu agar tidak bocor memori.

import { Chart } from "chart.js/auto";

let chartInstance = null;

const PALETTE = ["#0f1f3d", "#b8892b", "#1f8a56", "#c0392b", "#5b6ee1", "#e9c877", "#8e6c34", "#6b7280", "#4a90a4"];

export function renderCategoryChart(canvasId, byCategoryMap) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const labels = Object.keys(byCategoryMap);
  const data = Object.values(byCategoryMap);

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (labels.length === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: PALETTE }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } }
    }
  });
}

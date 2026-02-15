import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function TrendChart({ data, labels, type = 'line', title }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const chart = new Chart(canvasRef.current, {
      type,
      data: {
        labels,
        datasets: [
          {
            label: title,
            data,
            backgroundColor: 'rgba(59,130,246,0.2)',
            borderColor: 'rgba(59,130,246,1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
    return () => chart.destroy();
  }, [data, labels, type, title]);

  return <canvas ref={canvasRef} height={120} />;
}

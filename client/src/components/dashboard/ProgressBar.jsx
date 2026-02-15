export default function ProgressBar({ value, max, color = 'blue' }) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-16 bg-gray-200 rounded-full h-2">
      <div 
        className={`bg-${color}-500 h-2 rounded-full`} 
        style={{ width: `${percent}%` }}
      ></div>
    </div>
  );
}

import { Card } from '@/components/ui/card';

export default function StatCard({ title, value, icon, subtitle, color = 'blue', children }) {
  return (
    <Card className={`p-6 bg-white shadow-lg rounded-lg border border-gray-200 flex-1`}> 
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <h3 className={`text-2xl font-bold text-gray-900 mt-1`}>{value}</h3>
        </div>
        <div className={`p-3 bg-${color}-100 rounded-full`}>{icon}</div>
      </div>
      {subtitle && <div className="mt-4 text-sm text-gray-600">{subtitle}</div>}
      {children}
    </Card>
  );
}

interface StatsCardProps {
  title: string;
  value: string;
  description: string;
}

export function StatsCard({ title, value, description }: StatsCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

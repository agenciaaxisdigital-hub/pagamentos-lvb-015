export function CardSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden animate-pulse">
      <div className="p-3 pb-2 space-y-2">
        <div className="flex justify-between">
          <div className="space-y-1.5 flex-1">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
          <div className="h-4 bg-muted rounded w-20" />
        </div>
      </div>
      <div className="grid grid-cols-3 border-t border-border divide-x divide-border bg-muted/40">
        {[1, 2, 3].map((i) => (
          <div key={i} className="py-2 px-1 flex flex-col items-center gap-1">
            <div className="h-2 bg-muted-foreground/10 rounded w-10" />
            <div className="h-4 bg-muted-foreground/10 rounded w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

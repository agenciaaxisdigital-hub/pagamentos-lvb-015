interface Props {
  message?: string;
}

export function LoadingScreen({ message = "Carregando..." }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
      <div
        className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "rgba(236, 72, 153, 0.25)", borderTopColor: "#ec4899" }}
      />
      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "#c8aa64" }}>
        {message}
      </p>
    </div>
  );
}

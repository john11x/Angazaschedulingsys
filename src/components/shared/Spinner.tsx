export default function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-10 w-10 rounded-full border-2 border-[var(--color-brand)] border-t-transparent animate-spin ${className}`}
      aria-hidden
    />
  );
}

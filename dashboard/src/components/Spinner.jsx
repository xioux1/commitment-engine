export function Spinner() {
  return <span className="font-mono text-xs text-gray-600">Loading…</span>;
}

export function InlineError({ message }) {
  return <span className="font-mono text-xs text-[#f87171]">{message}</span>;
}

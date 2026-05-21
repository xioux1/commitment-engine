export function USDCAmount({ amount, className = '' }) {
  const n = Number(amount || 0).toFixed(2);
  return (
    <span className={`font-mono ${className}`}>
      {n} <span className="text-gray-600 text-xs">USDC</span>
    </span>
  );
}

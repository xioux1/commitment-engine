export function TxHash({ hash, chainName = 'base' }) {
  if (!hash) return <span className="text-gray-700 font-mono text-xs">—</span>;

  const baseUrl = chainName === 'baseSepolia'
    ? 'https://sepolia.basescan.org/tx/'
    : 'https://basescan.org/tx/';

  return (
    <a
      href={`${baseUrl}${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-[#a3e635] hover:underline"
    >
      {hash.slice(0, 8)}…{hash.slice(-6)}
    </a>
  );
}

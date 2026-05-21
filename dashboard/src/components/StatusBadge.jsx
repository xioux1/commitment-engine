const STYLES = {
  active:         'bg-[#a3e635]/10 text-[#a3e635]  border-[#a3e635]/30',
  pass:           'bg-[#a3e635]/10 text-[#a3e635]  border-[#a3e635]/30',
  confirmed:      'bg-[#a3e635]/10 text-[#a3e635]  border-[#a3e635]/30',
  reward:         'bg-[#a3e635]/10 text-[#a3e635]  border-[#a3e635]/30',
  fail:           'bg-[#f87171]/10 text-[#f87171]  border-[#f87171]/30',
  failed:         'bg-[#f87171]/10 text-[#f87171]  border-[#f87171]/30',
  penalty:        'bg-[#f87171]/10 text-[#f87171]  border-[#f87171]/30',
  pending:        'bg-[#fbbf24]/10 text-[#fbbf24]  border-[#fbbf24]/30',
  submitted:      'bg-[#fbbf24]/10 text-[#fbbf24]  border-[#fbbf24]/30',
  paused:         'bg-[#fbbf24]/10 text-[#fbbf24]  border-[#fbbf24]/30',
  dry_run_logged: 'bg-gray-800     text-gray-500    border-gray-700',
  completed:      'bg-gray-800     text-gray-500    border-gray-700',
  cancelled:      'bg-gray-800     text-gray-500    border-gray-700',
};

export function StatusBadge({ status }) {
  const cls = STYLES[status] || 'bg-gray-800 text-gray-400 border-gray-700';
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${cls}`}>
      {String(status).replace(/_/g, ' ')}
    </span>
  );
}

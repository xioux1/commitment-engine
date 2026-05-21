import { useState } from 'react';
import { useFetch }       from '../hooks/useFetch';
import { StatusBadge }    from '../components/StatusBadge';
import { TxHash }         from '../components/TxHash';
import { USDCAmount }     from '../components/USDCAmount';
import { SectionHeader }  from '../components/SectionHeader';
import { Spinner, InlineError } from '../components/Spinner';

const STATUS_OPTIONS = ['', 'pending', 'submitted', 'confirmed', 'failed', 'dry_run_logged'];
const fmtTs = (d) => new Date(d).toLocaleString();

export function Wallet() {
  const [statusFilter, setStatusFilter] = useState('');

  const balanceUrl = '/vault/balance';
  const actionsUrl = `/wallet-actions?limit=100${statusFilter ? `&status=${statusFilter}` : ''}`;

  const balance = useFetch(balanceUrl);
  const actions = useFetch(actionsUrl);

  const rows      = actions.data?.data || [];
  const chainName = balance.data?.chain_name || 'base';

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader>Vault balance</SectionHeader>

        {balance.error && (
          <div className="mb-4 bg-[#f87171]/10 border border-[#f87171]/30 px-4 py-2">
            <InlineError message={`Contract not reachable: ${balance.error}`} />
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#111] border border-[#222] p-4">
            <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-2">Available</div>
            {balance.loading ? <Spinner /> : (
              <USDCAmount
                amount={balance.data?.available_balance}
                className="text-2xl text-[#a3e635]"
              />
            )}
          </div>
          <div className="bg-[#111] border border-[#222] p-4">
            <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-2">Locked rewards</div>
            {balance.loading ? <Spinner /> : (
              <USDCAmount amount={balance.data?.locked_balance} className="text-2xl text-gray-100" />
            )}
          </div>
          <div className="bg-[#111] border border-[#222] p-4">
            <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-2">Network</div>
            <span className="font-mono text-sm text-gray-300">
              {balance.data?.chain_name || '—'}
            </span>
            {balance.data?.configured === false && (
              <div className="font-mono text-[10px] text-[#fbbf24] mt-1">Contract not configured</div>
            )}
          </div>
        </div>
      </div>

      {/* Actions table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <SectionHeader>Wallet actions</SectionHeader>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] text-gray-300 font-mono text-xs px-2 py-1 outline-none"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s || 'All statuses'}</option>
            ))}
          </select>
        </div>

        <div className="bg-[#111] border border-[#222] overflow-x-auto">
          {actions.loading ? (
            <div className="p-4"><Spinner /></div>
          ) : actions.error ? (
            <div className="p-4"><InlineError message={actions.error} /></div>
          ) : rows.length === 0 ? (
            <div className="p-4 font-mono text-xs text-gray-600">No wallet actions found.</div>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-[#222] text-[10px] text-gray-600 uppercase tracking-widest">
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Amount</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">Tx Hash</th>
                  <th className="text-left px-4 py-2 hidden lg:table-cell">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(a => (
                  <tr key={a.id} className="border-b border-[#1a1a1a] last:border-0">
                    <td className="px-4 py-2.5">
                      <StatusBadge status={a.action_type} />
                      {a.dry_run && (
                        <span className="ml-1.5 text-[10px] font-mono text-[#fbbf24]">DRY RUN</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <USDCAmount amount={a.amount_usdc} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <TxHash hash={a.tx_hash} chainName={chainName} />
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 hidden lg:table-cell">
                      {fmtTs(a.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

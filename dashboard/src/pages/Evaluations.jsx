import { useState } from 'react';
import { useFetch }       from '../hooks/useFetch';
import { StatusBadge }    from '../components/StatusBadge';
import { SectionHeader }  from '../components/SectionHeader';
import { Spinner, InlineError } from '../components/Spinner';

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtTs   = (d) => new Date(d).toLocaleString();

function RulesTarget(rules) {
  if (!Array.isArray(rules)) return null;
  const r = rules.find(r => r.metric === 'study_minutes');
  return r ? r.threshold : null;
}

export function Evaluations() {
  const [commitmentFilter, setCommitmentFilter] = useState('');
  const [resultFilter,     setResultFilter]     = useState('');
  const [expanded,         setExpanded]         = useState(null);

  const commitmentsData = useFetch('/commitments?limit=100');
  const commitmentList  = commitmentsData.data?.data || [];

  const params = new URLSearchParams({ limit: 100 });
  if (commitmentFilter) params.set('commitment_id', commitmentFilter);
  if (resultFilter)     params.set('result', resultFilter);
  const evalsData = useFetch(`/evaluations?${params}`);
  const rows      = evalsData.data?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader>Evaluations history</SectionHeader>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <select
            value={commitmentFilter}
            onChange={e => setCommitmentFilter(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] text-gray-300 font-mono text-xs px-2 py-1 outline-none"
          >
            <option value="">All commitments</option>
            {commitmentList.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <select
            value={resultFilter}
            onChange={e => setResultFilter(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] text-gray-300 font-mono text-xs px-2 py-1 outline-none"
          >
            <option value="">All results</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
        </div>

        <div className="bg-[#111] border border-[#222] overflow-x-auto">
          {evalsData.loading ? (
            <div className="p-4"><Spinner /></div>
          ) : evalsData.error ? (
            <div className="p-4"><InlineError message={evalsData.error} /></div>
          ) : rows.length === 0 ? (
            <div className="p-4 font-mono text-xs text-gray-600">No evaluations match.</div>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-[#222] text-[10px] text-gray-600 uppercase tracking-widest">
                  <th className="text-left px-4 py-2">Period</th>
                  <th className="text-left px-4 py-2">Result</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">Study min</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">Target</th>
                  <th className="text-left px-4 py-2 hidden lg:table-cell">Evaluated at</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(e => {
                  const isOpen    = expanded === e.id;
                  const metrics   = e.metrics_data?.metrics || {};
                  const target    = RulesTarget(e.rules_snapshot);

                  return (
                    <>
                      <tr
                        key={e.id}
                        className="border-b border-[#1a1a1a] cursor-pointer hover:bg-[#151515] transition-colors"
                        onClick={() => setExpanded(isOpen ? null : e.id)}
                      >
                        <td className="px-4 py-2.5 text-gray-300">
                          {fmtDate(e.period_start)} – {fmtDate(e.period_end)}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={e.result} />
                        </td>
                        <td className="px-4 py-2.5 text-gray-300 hidden md:table-cell">
                          {metrics.study_minutes ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">
                          {target ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 hidden lg:table-cell">
                          {fmtTs(e.evaluated_at)}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${e.id}-exp`} className="bg-[#0d0d0d] border-b border-[#1a1a1a]">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">
                              Raw metrics snapshot
                            </div>
                            <pre className="text-[11px] text-gray-400 overflow-x-auto">
                              {JSON.stringify(metrics, null, 2)}
                            </pre>
                            {e.rule_results?.length > 0 && (
                              <>
                                <div className="text-[10px] text-gray-600 uppercase tracking-widest mt-3 mb-2">
                                  Rule results
                                </div>
                                <div className="space-y-1">
                                  {e.rule_results.map((r, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                      <StatusBadge status={r.passed ? 'pass' : 'fail'} />
                                      <span className="text-gray-400">
                                        {r.rule?.metric} {r.rule?.operator} {r.rule?.threshold}
                                        {' → '}actual: <span className={r.passed ? 'text-[#a3e635]' : 'text-[#f87171]'}>
                                          {r.actual_value}
                                        </span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

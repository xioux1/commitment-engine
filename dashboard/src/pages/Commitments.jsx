import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch }       from '../hooks/useFetch';
import { StatusBadge }    from '../components/StatusBadge';
import { USDCAmount }     from '../components/USDCAmount';
import { SectionHeader }  from '../components/SectionHeader';
import { Spinner, InlineError } from '../components/Spinner';
import { api } from '../api/client';

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function rulesText(rules, logic) {
  if (!Array.isArray(rules)) return '—';
  const parts = rules.map(r => `${r.metric} ${r.operator} ${r.threshold}`);
  return parts.join(logic === 'any' ? ' OR ' : ' AND ');
}

export function Commitments() {
  const { data, loading, error } = useFetch('/commitments?limit=100');
  const evalsData = useFetch('/evaluations?limit=100');
  const [evaluating, setEvaluating] = useState(null);
  const [evalResult, setEvalResult] = useState({});

  const rows = data?.data || [];

  // Build a per-commitment last-eval lookup
  const lastEvalByCommitment = {};
  for (const e of (evalsData.data?.data || [])) {
    if (!lastEvalByCommitment[e.commitment_id]) {
      lastEvalByCommitment[e.commitment_id] = e;
    }
  }

  async function triggerEval(id) {
    setEvaluating(id);
    try {
      const res = await api.post(`/commitments/${id}/evaluate`);
      setEvalResult(r => ({ ...r, [id]: { ok: true, result: res.data?.evaluation?.result } }));
    } catch (err) {
      setEvalResult(r => ({ ...r, [id]: { ok: false, error: err.message } }));
    } finally {
      setEvaluating(null);
    }
  }

  const active   = rows.filter(c => c.status === 'active');
  const inactive = rows.filter(c => c.status !== 'active');

  function CommitmentCard({ c }) {
    const lastEval = lastEvalByCommitment[c.id];
    const triggered = evalResult[c.id];
    return (
      <div className="bg-[#111] border border-[#222] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Link
                to={`/commitments/${c.id}`}
                className="font-mono text-sm text-gray-100 hover:text-[#a3e635] transition-colors"
              >
                {c.title}
              </Link>
              <StatusBadge status={c.status} />
              {c.dry_run && <StatusBadge status="dry_run_logged" />}
            </div>

            <div className="font-mono text-xs text-gray-500 mb-2">
              {rulesText(c.rules, c.logic)} — {c.period}
            </div>

            <div className="flex flex-wrap gap-4 text-xs font-mono text-gray-500">
              {c.penalty_amount_usdc != null && (
                <span>
                  penalty:{' '}
                  <span className="text-[#f87171]">
                    <USDCAmount amount={c.penalty_amount_usdc} />
                  </span>
                </span>
              )}
              {c.reward_amount_usdc != null && (
                <span>
                  reward:{' '}
                  <span className="text-[#a3e635]">
                    <USDCAmount amount={c.reward_amount_usdc} />
                  </span>
                </span>
              )}
              <span>since {new Date(c.start_date).toLocaleDateString()}</span>
              {lastEval && !triggered && (
                <span className="flex items-center gap-1.5">
                  last:{' '}
                  <StatusBadge status={lastEval.result} />
                  <span className="text-gray-600">{fmtDate(lastEval.period_start)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {c.status === 'active' && (
              <button
                onClick={() => triggerEval(c.id)}
                disabled={evaluating === c.id}
                className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-[#333] text-gray-400 hover:border-[#a3e635] hover:text-[#a3e635] transition-colors disabled:opacity-40"
              >
                {evaluating === c.id ? 'Running…' : 'Evaluate now'}
              </button>
            )}

            {triggered && (
              <span className={`font-mono text-[10px] ${
                triggered.ok
                  ? triggered.result === 'pass' ? 'text-[#a3e635]' : 'text-[#f87171]'
                  : 'text-[#f87171]'
              }`}>
                {triggered.ok
                  ? `→ ${triggered.result?.toUpperCase()}`
                  : triggered.error}
              </span>
            )}

            <Link
              to={`/commitments/${c.id}`}
              className="font-mono text-[10px] text-gray-600 hover:text-gray-400 underline"
            >
              history →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader>Commitments</SectionHeader>

      {(loading || evalsData.loading) && <Spinner />}
      {error && <InlineError message={error} />}

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(c => <CommitmentCard key={c.id} c={c} />)}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest pt-2">Inactive</div>
          {inactive.map(c => <CommitmentCard key={c.id} c={c} />)}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="font-mono text-xs text-gray-600">No commitments found.</div>
      )}
    </div>
  );
}

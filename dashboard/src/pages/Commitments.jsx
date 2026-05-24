import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch }       from '../hooks/useFetch';
import { StatusBadge }    from '../components/StatusBadge';
import { USDCAmount }     from '../components/USDCAmount';
import { SectionHeader }  from '../components/SectionHeader';
import { Spinner, InlineError } from '../components/Spinner';
import { api } from '../api/client';

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const METRICS = [
  'study_minutes',
  'study_sessions',
  'cards_reviewed',
  'oral_evaluations',
  'physical_activity_sessions',
  'physical_activity_minutes',
];

const OPERATORS = ['>=', '<=', '>', '<', '=='];

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

const INPUT = 'w-full bg-[#0a0a0a] border border-[#333] font-mono text-xs text-gray-200 px-3 py-2 focus:outline-none focus:border-[#a3e635] appearance-none';
const LABEL = 'block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1';

const EMPTY_FORM = {
  title: '',
  metric: 'study_minutes',
  operator: '>=',
  threshold: '',
  period: 'weekly',
  evaluation_day_of_week: 1,
  start_date: new Date().toISOString().split('T')[0],
  penalty_amount_usdc: '',
  penalty_wallet: '',
  dry_run: true,
};

function NewCommitmentModal({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim())        return setError('Title is required');
    if (form.threshold === '')     return setError('Threshold is required');
    if (!form.start_date)          return setError('Start date is required');

    const userId = import.meta.env.VITE_USER_ID || 'default';

    const body = {
      user_id:    userId,
      title:      form.title.trim(),
      rules:      [{ metric: form.metric, operator: form.operator, threshold: Number(form.threshold) }],
      logic:      'all',
      period:     form.period,
      start_date: form.start_date,
      dry_run:    form.dry_run,
      ...(form.period === 'weekly' && { evaluation_day_of_week: Number(form.evaluation_day_of_week) }),
      ...(form.penalty_wallet.trim()      && { penalty_wallet:      form.penalty_wallet.trim() }),
      ...(form.penalty_amount_usdc !== '' && { penalty_amount_usdc: Number(form.penalty_amount_usdc) }),
    };

    setSaving(true);
    try {
      await api.post('/commitments', body);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#0f0f0f] border border-[#2a2a2a] w-full max-w-md mx-4 p-6">
        <div className="text-[11px] font-mono text-[#a3e635] uppercase tracking-[0.2em] mb-5">
          New Commitment
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className={LABEL}>Title</label>
            <input
              className={INPUT}
              placeholder="Eg. Weekly study goal"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>

          {/* Rule: metric + operator + threshold */}
          <div>
            <label className={LABEL}>Rule</label>
            <div className="grid grid-cols-3 gap-2">
              <select className={INPUT} value={form.metric} onChange={e => set('metric', e.target.value)}>
                {METRICS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className={INPUT} value={form.operator} onChange={e => set('operator', e.target.value)}>
                {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <input
                type="number"
                className={INPUT}
                placeholder="600"
                value={form.threshold}
                onChange={e => set('threshold', e.target.value)}
              />
            </div>
          </div>

          {/* Period + Start date */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL}>Period</label>
              <select className={INPUT} value={form.period} onChange={e => set('period', e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Start date</label>
              <input
                type="date"
                className={INPUT}
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
              />
            </div>
          </div>

          {/* Period-dependent: evaluation day (weekly only) */}
          {form.period === 'weekly' && (
            <div>
              <label className={LABEL}>Evaluation day</label>
              <select
                className={INPUT}
                value={form.evaluation_day_of_week}
                onChange={e => set('evaluation_day_of_week', e.target.value)}
              >
                {DAYS_OF_WEEK.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Penalty */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL}>Penalty amount (USDC)</label>
              <input
                type="number"
                className={INPUT}
                placeholder="0.00"
                value={form.penalty_amount_usdc}
                onChange={e => set('penalty_amount_usdc', e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Penalty wallet</label>
              <input
                className={INPUT}
                placeholder="0x…"
                value={form.penalty_wallet}
                onChange={e => set('penalty_wallet', e.target.value)}
              />
            </div>
          </div>

          {/* Dry run */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="accent-[#a3e635]"
              checked={form.dry_run}
              onChange={e => set('dry_run', e.target.checked)}
            />
            <span className="font-mono text-xs text-gray-400">Dry run (log only, no on-chain actions)</span>
          </label>

          {error && <div className="font-mono text-xs text-[#f87171]">{error}</div>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#3a4a1a] border border-[#a3e635]/40 font-mono text-xs text-[#a3e635] uppercase tracking-widest py-2 hover:bg-[#4a5a2a] transition-colors disabled:opacity-40"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-[#333] font-mono text-xs text-gray-500 uppercase tracking-widest py-2 hover:border-[#555] hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function rulesText(rules, logic) {
  if (!Array.isArray(rules)) return '—';
  const parts = rules.map(r => `${r.metric} ${r.operator} ${r.threshold}`);
  return parts.join(logic === 'any' ? ' OR ' : ' AND ');
}

export function Commitments() {
  const { data, loading, error, refetch } = useFetch('/commitments?limit=100');
  const evalsData = useFetch('/evaluations?limit=100');
  const [evaluating, setEvaluating] = useState(null);
  const [evalResult, setEvalResult] = useState({});
  const [showNew, setShowNew] = useState(false);

  const rows = data?.data || [];

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
      <div className="flex items-center justify-between">
        <SectionHeader>Commitments</SectionHeader>
        <button
          onClick={() => setShowNew(true)}
          className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-[#333] text-gray-400 hover:border-[#a3e635] hover:text-[#a3e635] transition-colors"
        >
          + New
        </button>
      </div>

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

      {showNew && (
        <NewCommitmentModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); refetch?.(); }}
        />
      )}
    </div>
  );
}

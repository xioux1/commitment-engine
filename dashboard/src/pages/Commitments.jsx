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

function EditModal({ commitment, onClose, onSaved }) {
  const [title,  setTitle]  = useState(commitment.title);
  const [amount, setAmount] = useState(commitment.penalty_amount_usdc ?? '');
  const [wallet, setWallet] = useState(commitment.penalty_wallet ?? '');
  const [dryRun, setDryRun] = useState(commitment.dry_run ?? false);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const body = { title, dry_run: dryRun };
      if (amount !== '') body.penalty_amount_usdc = parseFloat(amount);
      if (wallet !== '') body.penalty_wallet = wallet;
      const res = await api.patch(`/commitments/${commitment.id}`, body);
      onSaved(res.data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#111] border border-[#333] p-6 w-full max-w-md space-y-4">
        <div className="font-mono text-xs text-gray-400 uppercase tracking-widest">Edit commitment</div>

        <div className="space-y-3">
          <div>
            <label className="block font-mono text-[10px] text-gray-600 uppercase tracking-widest mb-1">Title</label>
            <input
              className="w-full bg-[#1a1a1a] border border-[#333] text-gray-100 font-mono text-sm px-3 py-2 focus:outline-none focus:border-[#a3e635]"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] text-gray-600 uppercase tracking-widest mb-1">Penalty amount (USDC)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full bg-[#1a1a1a] border border-[#333] text-gray-100 font-mono text-sm px-3 py-2 focus:outline-none focus:border-[#a3e635]"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] text-gray-600 uppercase tracking-widest mb-1">Penalty wallet</label>
            <input
              className="w-full bg-[#1a1a1a] border border-[#333] text-gray-100 font-mono text-xs px-3 py-2 focus:outline-none focus:border-[#a3e635]"
              value={wallet}
              onChange={e => setWallet(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="accent-[#a3e635]" />
            <span className="font-mono text-xs text-gray-500">Dry run (log only, no on-chain actions)</span>
          </label>
        </div>

        {err && <div className="font-mono text-xs text-[#f87171]">{err}</div>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="flex-1 font-mono text-xs uppercase tracking-wider px-4 py-2 bg-[#a3e635] text-black hover:bg-[#bef264] disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-wider px-4 py-2 border border-[#333] text-gray-400 hover:border-gray-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const OPERATORS = ['>=', '<=', '>', '<', '=='];
const METRICS   = ['study_minutes', 'study_sessions', 'cards_reviewed', 'oral_evaluations', 'physical_activity_minutes', 'physical_activity_sessions'];

function NewModal({ onClose, onCreated }) {
  const today = new Date().toISOString().split('T')[0];
  const [title,      setTitle]      = useState('');
  const [metric,     setMetric]     = useState('study_minutes');
  const [operator,   setOperator]   = useState('>=');
  const [threshold,  setThreshold]  = useState(600);
  const [period,     setPeriod]     = useState('weekly');
  const [amount,     setAmount]     = useState('');
  const [wallet,     setWallet]     = useState('0x000000000000000000000000000000000000dEaD');
  const [startDate,  setStartDate]  = useState(today);
  const [dryRun,     setDryRun]     = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const body = {
        user_id: '1',
        title,
        rules: [{ metric, operator, threshold: Number(threshold) }],
        logic: 'all',
        period,
        start_date: startDate,
        penalty_enabled: !!(amount && wallet),
        penalty_wallet:  wallet || null,
        penalty_amount_usdc: amount ? parseFloat(amount) : null,
        dry_run: dryRun,
      };
      const res = await api.post('/commitments', body);
      onCreated(res.data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full bg-[#1a1a1a] border border-[#333] text-gray-100 font-mono text-sm px-3 py-2 focus:outline-none focus:border-[#a3e635]';
  const labelCls = 'block font-mono text-[10px] text-gray-600 uppercase tracking-widest mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#111] border border-[#333] p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="font-mono text-xs text-gray-400 uppercase tracking-widest">New commitment</div>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Title</label>
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="Eg. Weekly study goal" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Metric</label>
              <select className={inputCls} value={metric} onChange={e => setMetric(e.target.value)}>
                {METRICS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Operator</label>
              <select className={inputCls} value={operator} onChange={e => setOperator(e.target.value)}>
                {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Threshold</label>
              <input type="number" className={inputCls} value={threshold} onChange={e => setThreshold(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Period</label>
              <select className={inputCls} value={period} onChange={e => setPeriod(e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Start date</label>
              <input type="date" className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Penalty amount (USDC)</label>
            <input type="number" min="0" step="0.01" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </div>

          <div>
            <label className={labelCls}>Penalty wallet</label>
            <input className={inputCls + ' text-xs'} value={wallet} onChange={e => setWallet(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="accent-[#a3e635]" />
            <span className="font-mono text-xs text-gray-500">Dry run (log only, no on-chain actions)</span>
          </label>
        </div>

        {err && <div className="font-mono text-xs text-[#f87171]">{err}</div>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="flex-1 font-mono text-xs uppercase tracking-wider px-4 py-2 bg-[#a3e635] text-black hover:bg-[#bef264] disabled:opacity-40 transition-colors"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-wider px-4 py-2 border border-[#333] text-gray-400 hover:border-gray-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function Commitments() {
  const { data, loading, error } = useFetch('/commitments?limit=100');
  const evalsData = useFetch('/evaluations?limit=100');
  const [evaluating,  setEvaluating]  = useState(null);
  const [evalResult,  setEvalResult]  = useState({});
  const [editing,     setEditing]     = useState(null);
  const [creating,    setCreating]    = useState(false);
  const [localRows,   setLocalRows]   = useState(null);
  const [confirming,  setConfirming]  = useState(null);

  const allRows = localRows ?? (data?.data || []);

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

  async function deleteCommitment(id) {
    try {
      await api.delete(`/commitments/${id}`);
      setLocalRows(allRows.filter(c => c.id !== id));
      setConfirming(null);
    } catch (e) {
      setConfirming(null);
      console.error(e);
    }
  }

  function handleSaved(updated) {
    setLocalRows(allRows.map(c => c.id === updated.id ? updated : c));
    setEditing(null);
  }

  function handleCreated(created) {
    setLocalRows([created, ...allRows]);
    setCreating(false);
  }

  const active   = allRows.filter(c => c.status === 'active');
  const inactive = allRows.filter(c => c.status !== 'active');

  function CommitmentCard({ c }) {
    const lastEval  = lastEvalByCommitment[c.id];
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

            <div className="flex gap-2">
              <button
                onClick={() => setEditing(c)}
                className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-[#333] text-gray-400 hover:border-[#60a5fa] hover:text-[#60a5fa] transition-colors"
              >
                Edit
              </button>
              {confirming === c.id ? (
                <>
                  <button
                    onClick={() => deleteCommitment(c.id)}
                    className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-[#f87171] text-[#f87171] transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-[#333] text-gray-400 hover:border-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirming(c.id)}
                  className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-[#333] text-gray-400 hover:border-[#f87171] hover:text-[#f87171] transition-colors"
                >
                  Delete
                </button>
              )}
            </div>

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
          onClick={() => setCreating(true)}
          className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-[#333] text-gray-400 hover:border-[#a3e635] hover:text-[#a3e635] transition-colors"
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

      {!loading && allRows.length === 0 && (
        <div className="font-mono text-xs text-gray-600">No commitments found.</div>
      )}

      {creating && (
        <NewModal
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}

      {editing && (
        <EditModal
          commitment={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

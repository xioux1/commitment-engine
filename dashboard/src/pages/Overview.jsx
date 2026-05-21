import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { useFetch }       from '../hooks/useFetch';
import { StatusBadge }    from '../components/StatusBadge';
import { TxHash }         from '../components/TxHash';
import { SectionHeader }  from '../components/SectionHeader';
import { Spinner, InlineError } from '../components/Spinner';

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-[#111] border border-[#222] p-4">
      <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-2xl font-mono ${accent || 'text-gray-100'}`}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtTs   = (d) => new Date(d).toLocaleString();

function computeStreak(rows) {
  let n = 0;
  for (const e of rows) {
    if (e.result === 'pass') n++;
    else break;
  }
  return n;
}

export function Overview() {
  const balance     = useFetch('/vault/balance');
  const evals       = useFetch('/evaluations?limit=50');
  const actions     = useFetch('/wallet-actions?limit=5');
  const pendingAct  = useFetch('/wallet-actions?status=pending&limit=50');
  const weekly      = useFetch('/metrics/weekly-history?weeks=8');
  const commitments = useFetch('/commitments');

  const evalRows    = evals.data?.data     || [];
  const actionRows  = actions.data?.data   || [];
  const pendingRows = pendingAct.data?.data || [];
  const weeklyData  = weekly.data?.data    || [];
  const target      = weekly.data?.study_minutes_target;
  const allCommits  = commitments.data?.data || [];
  const activeCount = allCommits.filter(c => c.status === 'active').length;
  const chainName   = balance.data?.chain_name || 'base';

  const commitmentMap = Object.fromEntries(allCommits.map(c => [c.id, c.title]));

  const passN    = evalRows.filter(e => e.result === 'pass').length;
  const failN    = evalRows.filter(e => e.result === 'fail').length;
  const totalN   = passN + failN;
  const passRate = totalN > 0 ? Math.round((passN / totalN) * 100) : null;
  const streak   = computeStreak(evalRows);

  const livePending = pendingRows.filter(a => !a.dry_run);

  // Map period_start → eval result for chart dot coloring
  const evalByWeek = {};
  for (const e of evalRows) {
    const key = new Date(e.period_start).toDateString();
    if (!evalByWeek[key]) evalByWeek[key] = e.result;
  }
  const chartData = weeklyData.map(w => ({
    ...w,
    _result: evalByWeek[new Date(w.week).toDateString()] || null,
  }));

  const passRateAccent =
    passRate == null      ? 'text-gray-600'
    : passRate >= 80      ? 'text-[#a3e635]'
    : passRate >= 50      ? 'text-[#fbbf24]'
    : 'text-[#f87171]';

  const streakAccent =
    streak >= 4 ? 'text-[#a3e635]'
    : streak > 0 ? 'text-gray-100'
    : 'text-gray-600';

  return (
    <div className="space-y-10">
      <div>
        <SectionHeader>System status</SectionHeader>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          <StatCard label="Active commitments" value={activeCount} />
          <StatCard
            label="Pass rate"
            value={passRate != null ? `${passRate}%` : '—'}
            sub={totalN > 0 ? `${passN} pass / ${failN} fail` : 'no evaluations yet'}
            accent={passRateAccent}
          />
          <StatCard
            label="Streak"
            value={streak > 0 ? `${streak}w` : '—'}
            sub={streak > 0 ? 'consecutive passes' : 'no streak yet'}
            accent={streakAccent}
          />
          <StatCard
            label="Available"
            value={balance.loading ? '…' : `${balance.data?.available_balance ?? '0.00'}`}
            sub="USDC in vault"
            accent="text-[#a3e635]"
          />
        </div>

        {livePending.length > 0 && (
          <div className="flex items-center gap-3 bg-[#f87171]/10 border border-[#f87171]/30 px-4 py-2">
            <span className="text-[#f87171] text-xs">●</span>
            <span className="font-mono text-xs text-[#f87171]">
              {livePending.length} wallet action{livePending.length !== 1 ? 's' : ''} pending execution —{' '}
              <Link to="/wallet" className="underline hover:text-white">view wallet</Link>
            </span>
          </div>
        )}
      </div>

      {/* Study minutes chart */}
      <section>
        <SectionHeader>Study minutes — last 8 weeks</SectionHeader>
        <div className="bg-[#111] border border-[#222] p-4">
          {weekly.loading ? (
            <Spinner />
          ) : weekly.error ? (
            <InlineError message={weekly.error} />
          ) : weeklyData.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center font-mono text-xs text-gray-600">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1a1a1a" vertical={false} />
                <XAxis
                  dataKey="week"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 9, fontFamily: 'IBM Plex Mono', fill: '#4b5563' }}
                  axisLine={{ stroke: '#222' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fontFamily: 'IBM Plex Mono', fill: '#4b5563' }}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 0, padding: '6px 10px' }}
                  labelStyle={{ color: '#6b7280', fontFamily: 'IBM Plex Mono', fontSize: 10 }}
                  itemStyle={{ color: '#a3e635', fontFamily: 'IBM Plex Mono', fontSize: 11 }}
                  labelFormatter={(v) => new Date(v).toLocaleDateString()}
                  formatter={(v) => [`${v} min`, 'study']}
                />
                {target != null && (
                  <ReferenceLine
                    y={target}
                    stroke="#fbbf24"
                    strokeDasharray="3 3"
                    label={{ value: `target ${target}`, fill: '#fbbf24', fontSize: 9, fontFamily: 'IBM Plex Mono', position: 'right' }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="study_minutes"
                  stroke="#a3e635"
                  strokeWidth={1.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const color = payload._result === 'fail' ? '#f87171' : '#a3e635';
                    return <circle key={`d${cx}`} cx={cx} cy={cy} r={3} fill={color} stroke="none" />;
                  }}
                  activeDot={{ r: 4, fill: '#a3e635' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Recent activity */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader>Recent evaluations</SectionHeader>
          <div className="bg-[#111] border border-[#222]">
            {evals.loading ? (
              <div className="p-4"><Spinner /></div>
            ) : evals.error ? (
              <div className="p-4"><InlineError message={evals.error} /></div>
            ) : evalRows.length === 0 ? (
              <div className="p-4 font-mono text-xs text-gray-600">No evaluations yet.</div>
            ) : evalRows.slice(0, 8).map(e => (
              <div key={e.id} className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a] last:border-0">
                <div>
                  <div className="font-mono text-xs text-gray-300">
                    {fmtDate(e.period_start)} – {fmtDate(e.period_end)}
                  </div>
                  {commitmentMap[e.commitment_id] && (
                    <div className="font-mono text-[10px] text-gray-600 mt-0.5">
                      {commitmentMap[e.commitment_id]}
                    </div>
                  )}
                </div>
                <StatusBadge status={e.result} />
              </div>
            ))}
          </div>
          {evalRows.length > 8 && (
            <Link to="/evaluations" className="block text-center font-mono text-[10px] text-gray-600 hover:text-gray-400 mt-2">
              view all {evalRows.length > 50 ? '50+' : evalRows.length} evaluations →
            </Link>
          )}
        </div>

        <div>
          <SectionHeader>Recent wallet actions</SectionHeader>
          <div className="bg-[#111] border border-[#222]">
            {actions.loading ? (
              <div className="p-4"><Spinner /></div>
            ) : actions.error ? (
              <div className="p-4"><InlineError message={actions.error} /></div>
            ) : actionRows.length === 0 ? (
              <div className="p-4 font-mono text-xs text-gray-600">No wallet actions yet.</div>
            ) : actionRows.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a] last:border-0">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.action_type} />
                    <span className="font-mono text-xs text-gray-300">
                      {Number(a.amount_usdc).toFixed(2)} USDC
                    </span>
                    {a.dry_run && <span className="font-mono text-[10px] text-gray-600">dry run</span>}
                  </div>
                  <TxHash hash={a.tx_hash} chainName={chainName} />
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
          {actionRows.length > 0 && (
            <Link to="/wallet" className="block text-center font-mono text-[10px] text-gray-600 hover:text-gray-400 mt-2">
              view wallet →
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

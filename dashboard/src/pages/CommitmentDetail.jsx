import { useParams, Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from 'recharts';
import { useFetch }       from '../hooks/useFetch';
import { StatusBadge }    from '../components/StatusBadge';
import { SectionHeader }  from '../components/SectionHeader';
import { Spinner, InlineError } from '../components/Spinner';

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const fmtTs   = (d) => new Date(d).toLocaleString();

function computeStreak(rows) {
  let n = 0;
  for (const e of rows) {
    if (e.result === 'pass') n++;
    else break;
  }
  return n;
}

export function CommitmentDetail() {
  const { id } = useParams();

  const commitment = useFetch(`/commitments/${id}`);
  const evals      = useFetch(`/evaluations?commitment_id=${id}&limit=50`);

  const c    = commitment.data?.data;
  const rows = evals.data?.data || [];

  const passN        = rows.filter(e => e.result === 'pass').length;
  const failN        = rows.filter(e => e.result === 'fail').length;
  const totalN       = passN + failN;
  const passRate     = totalN > 0 ? Math.round((passN / totalN) * 100) : null;
  const streak       = computeStreak(rows);
  const totalMinutes = rows.reduce((sum, e) => sum + (e.metrics_data?.metrics?.study_minutes ?? 0), 0);

  const chartData = [...rows].reverse().map(e => ({
    label:  fmtDate(e.period_start),
    pass:   e.result === 'pass' ? 1 : 0,
    fail:   e.result === 'fail' ? 1 : 0,
    result: e.result,
  }));

  const studyTarget = Array.isArray(c?.rules)
    ? c.rules.find(r => r.metric === 'study_minutes')?.threshold
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link to="/commitments" className="font-mono text-xs text-gray-600 hover:text-gray-400">
          ← commitments
        </Link>
      </div>

      {commitment.loading && <Spinner />}
      {commitment.error   && <InlineError message={commitment.error} />}

      {c && (
        <div className="bg-[#111] border border-[#222] p-5">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="font-mono text-base text-gray-100">{c.title}</h1>
            <StatusBadge status={c.status} />
            {c.dry_run && <StatusBadge status="dry_run_logged" />}
          </div>
          {c.description && (
            <p className="font-sans text-sm text-gray-500 mb-3">{c.description}</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Period</div>
              <div className="text-gray-300">{c.period}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Logic</div>
              <div className="text-gray-300">{c.logic?.toUpperCase()}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Started</div>
              <div className="text-gray-300">{new Date(c.start_date).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Ends</div>
              <div className="text-gray-300">{c.end_date ? new Date(c.end_date).toLocaleDateString() : '—'}</div>
            </div>
          </div>

          {Array.isArray(c.rules) && (
            <div className="mt-4">
              <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-2">Rules</div>
              <div className="space-y-1">
                {c.rules.map((r, i) => (
                  <div key={i} className="font-mono text-xs text-gray-400">
                    {r.metric} {r.operator} {r.threshold}
                    {r.description && <span className="text-gray-600"> — {r.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalN > 0 && (
            <div className="mt-5 pt-4 border-t border-[#1a1a1a] grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Pass rate</div>
                <div className={
                  passRate >= 80 ? 'text-[#a3e635]'
                  : passRate >= 50 ? 'text-[#fbbf24]'
                  : 'text-[#f87171]'
                }>
                  {passRate}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Streak</div>
                <div className={streak >= 4 ? 'text-[#a3e635]' : streak > 0 ? 'text-gray-200' : 'text-gray-600'}>
                  {streak > 0 ? `${streak}w` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Evaluations</div>
                <div className="text-gray-300">{passN}↑ {failN}↓</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Total study</div>
                <div className="text-gray-300">{totalMinutes.toLocaleString()} min</div>
              </div>
            </div>
          )}
        </div>
      )}

      {chartData.length > 0 && (
        <section>
          <SectionHeader>Evaluation history — pass / fail by period</SectionHeader>
          <div className="bg-[#111] border border-[#222] p-4">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} barSize={14}>
                <CartesianGrid stroke="#1a1a1a" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fontFamily: 'IBM Plex Mono', fill: '#4b5563' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 0 }}
                  formatter={(v, n) => [v ? n : '', '']}
                  cursor={{ fill: '#ffffff08' }}
                />
                <Bar dataKey="pass" name="PASS" stackId="a">
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.result === 'pass' ? '#a3e635' : '#1a1a1a'} />
                  ))}
                </Bar>
                <Bar dataKey="fail" name="FAIL" stackId="a">
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.result === 'fail' ? '#f87171' : '#1a1a1a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section>
        <SectionHeader>All evaluations</SectionHeader>
        <div className="bg-[#111] border border-[#222]">
          {evals.loading ? (
            <div className="p-4"><Spinner /></div>
          ) : evals.error ? (
            <div className="p-4"><InlineError message={evals.error} /></div>
          ) : rows.length === 0 ? (
            <div className="p-4 font-mono text-xs text-gray-600">No evaluations yet.</div>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-[#222] text-[10px] text-gray-600 uppercase tracking-widest">
                  <th className="text-left px-4 py-2">Period</th>
                  <th className="text-left px-4 py-2">Result</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">Study min</th>
                  <th className="text-left px-4 py-2 hidden lg:table-cell">Evaluated at</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(e => {
                  const metrics = e.metrics_data?.metrics || {};
                  const min     = metrics.study_minutes;
                  return (
                    <tr key={e.id} className="border-b border-[#1a1a1a] last:border-0">
                      <td className="px-4 py-2.5 text-gray-300">
                        {fmtDate(e.period_start)}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={e.result} /></td>
                      <td className={`px-4 py-2.5 hidden md:table-cell ${
                        min != null && studyTarget != null
                          ? min >= studyTarget ? 'text-[#a3e635]' : 'text-[#f87171]'
                          : 'text-gray-300'
                      }`}>
                        {min ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 hidden lg:table-cell">
                        {fmtTs(e.evaluated_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {totalN > 1 && (
                <tfoot>
                  <tr className="border-t border-[#222] text-[10px] text-gray-600">
                    <td className="px-4 py-2" colSpan={2}>Total ({totalN} evals)</td>
                    <td className="px-4 py-2 hidden md:table-cell text-gray-400">
                      {totalMinutes.toLocaleString()} min
                    </td>
                    <td className="hidden lg:table-cell" />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

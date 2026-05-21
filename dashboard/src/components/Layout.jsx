import { Link, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/',            label: 'Overview'    },
  { to: '/commitments', label: 'Commitments' },
  { to: '/evaluations', label: 'Evaluations' },
  { to: '/wallet',      label: 'Wallet'      },
];

export function Layout({ children }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans">
      <header className="border-b border-[#222] px-6 py-3 sticky top-0 bg-[#0a0a0a] z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="font-mono text-[#a3e635] text-xs tracking-[0.2em] uppercase">
            CommitmentVault
          </span>
          <nav className="flex gap-6">
            {NAV.map(({ to, label }) => {
              const active = pathname === to || (to !== '/' && pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  className={`font-mono text-xs tracking-wide transition-colors pb-0.5 border-b ${
                    active
                      ? 'text-[#a3e635] border-[#a3e635]'
                      : 'text-gray-500 border-transparent hover:text-gray-200'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}

import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

const FRAGMENTED_APPS = [
  { name: 'Lease Register', content: 'Tenant A — R45k\nTenant B — R32k\nEsc 8% · Exp Jun', width: 'w-44', height: 'h-28', x: 60, y: 30, rotate: '-1.5deg', delay: '0s' },
  { name: 'Billing System', content: 'INV-001 — R52k\nINV-002 — Pending', width: 'w-40', height: 'h-22', x: 490, y: 50, rotate: '2deg', delay: '0.3s' },
  { name: 'Bank Feed', content: 'In: R52k · R18k\nOut: R7k', width: 'w-36', height: 'h-20', x: 260, y: 170, rotate: '-0.5deg', delay: '0.6s' },
  { name: 'Maintenance', content: '● #142 Blocked Drain\n● #143 AC Repair\n○ #144 Lift Service', width: 'w-48', height: 'h-24', x: 510, y: 270, rotate: '1.5deg', delay: '0.9s' },
  { name: 'Reporting', content: 'Occupancy ████ 94%\nRevenue  ███  R842k\nArrears  █    R120k', width: 'w-44', height: 'h-24', x: 80, y: 330, rotate: '-2deg', delay: '1.2s' },
  { name: 'Tenant Inbox', content: '3 unread 🔴\n2 renewals 📄\n1 complaint ⚠', width: 'w-40', height: 'h-22', x: 410, y: 400, rotate: '1deg', delay: '1.5s', blur: true },
];

export function Problem() {
  return (
    <Section id="problem" className="relative overflow-hidden">
      <Container>
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-500/80 mb-6 font-medium">The Problem</p>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-white max-w-2xl mx-auto leading-[1.12]">
            Your portfolio runs on
            <br />
            <span className="text-zinc-400">six disconnected systems.</span>
          </h2>
          <p className="mt-4 text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed">
            Lease registers in spreadsheets. Billing in legacy ERP. Payments in a bank portal.
            Maintenance on messaging. Reports built by hand. None of them talk to each other.
          </p>
        </div>

        <div className="relative h-[480px] md:h-[540px] max-w-3xl mx-auto">
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 640 500" style={{ opacity: 0.08 }}>
            <line x1="200" y1="70" x2="310" y2="190" stroke="white" strokeWidth="0.5" />
            <line x1="530" y1="90" x2="380" y2="190" stroke="white" strokeWidth="0.5" />
            <line x1="310" y1="190" x2="310" y2="300" stroke="white" strokeWidth="0.5" />
            <line x1="550" y1="300" x2="450" y2="400" stroke="white" strokeWidth="0.5" />
            <line x1="160" y1="360" x2="380" y2="420" stroke="white" strokeWidth="0.5" />
          </svg>

          {FRAGMENTED_APPS.map((app) => (
            <div
              key={app.name}
              className={`absolute animate-float rounded-xl border border-white/[0.10] bg-white/[0.06] backdrop-blur-sm px-4 py-3 shadow-lg shadow-black/30 ${app.width} ${app.height} ${app.blur ? 'opacity-80' : ''}`}
              style={{ left: app.x, top: app.y, transform: `rotate(${app.rotate})`, animationDelay: app.delay }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                </div>
                <span className="text-[10px] text-zinc-400 font-light">{app.name}</span>
              </div>
              <div className="text-[10px] text-zinc-300 font-light leading-relaxed whitespace-pre-line">
                {app.content}
              </div>
            </div>
          ))}

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-medium">Disconnected</p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

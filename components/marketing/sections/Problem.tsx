import { Container } from '../layout/Container';
import { Section } from '../layout/Section';

const FRAGMENTED_APPS = [
  { name: 'Lease Register', content: 'Tenant A — R45k\nTenant B — R32k\nEsc 8% · Exp Jun', w: 'w-44', h: 'h-28', x: 20, y: 10, rotate: '-1.5deg', border: 'border-white/[0.12]', bg: 'bg-white/[0.07]', delay: '0s' },
  { name: 'Billing System', content: 'INV-001 — R52k\nINV-002 — Pending', w: 'w-40', h: 'h-22', x: 545, y: 45, rotate: '2deg', border: 'border-white/[0.08]', bg: 'bg-white/[0.05]', delay: '0.3s' },
  { name: 'Bank Feed', content: 'In: R52k · R18k\nOut: R7k', w: 'w-36', h: 'h-20', x: 155, y: 165, rotate: '0deg', border: 'border-white/[0.09]', bg: 'bg-white/[0.05]', delay: '0.6s' },
  { name: 'Maintenance', content: '● <span className="text-amber-400">#142 Blocked Drain</span>\n● #143 AC Repair\n○ #144 Lift Service', w: 'w-48', h: 'h-24', x: 525, y: 230, rotate: '1deg', border: 'border-white/[0.10]', bg: 'bg-white/[0.06]', delay: '0.9s' },
  { name: 'Reporting', content: 'Occupancy ████ 94%\nRevenue  ███  R842k\nArrears  █    <span className="text-amber-400">R120k</span>', w: 'w-44', h: 'h-24', x: 35, y: 355, rotate: '-2deg', border: 'border-white/[0.07]', bg: 'bg-white/[0.04]', delay: '1.2s' },
  { name: 'Tenant Inbox', content: '3 unread 🔴\n2 renewals 📄\n1 complaint ⚠', w: 'w-40', h: 'h-22', x: 465, y: 385, rotate: '0deg', border: 'border-white/[0.06]', bg: 'bg-white/[0.03]', delay: '1.5s', blur: true },
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

        <div className="relative h-[540px] md:h-[600px] max-w-3xl mx-auto">
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 640 500" style={{ opacity: 0.12 }}>
            <path d="M170 55 C210 70, 210 140, 240 170" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M560 90 C490 110, 440 140, 380 170" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M240 170 C280 210, 300 240, 350 280" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M540 280 C510 320, 490 370, 460 410" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M130 370 C230 380, 350 395, 460 410" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
          </svg>

          {FRAGMENTED_APPS.map((app) => (
            <div
              key={app.name}
              className={`absolute animate-float rounded-xl border ${app.border} ${app.bg} backdrop-blur-sm px-4 py-3 shadow-lg shadow-black/30 ${app.w} ${app.h} ${app.blur ? 'opacity-75' : ''}`}
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
            <p className="text-[11px] uppercase tracking-[0.5em] text-zinc-300 font-medium">Disconnected</p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

import { Container } from '../layout/Container';
import { Section } from '../layout/Section';
import { FileText, Receipt, Landmark, Wrench, Mail, Table2 } from 'lucide-react';

const FRAGMENTED_APPS = [
  { 
    name: 'Lease Register.xlsx', 
    icon: Table2,
    content: 'Tenant          Start     Expiry    Rental\nSandton Office   Jan 26    Jun 28    R52,000\nRosebank Mall    Jul 25    Jun 30    R48,500\nAlice Lane       Mar 24    Mar 27    R32,000',
    w: 'w-48', h: 'h-28', x: 25, y: 12, rotate: '-1.5deg', delay: '0s' 
  },
  { 
    name: 'Billing System', 
    icon: Receipt,
    content: 'Invoice #INV-10482\n\nRental        R52,000\nUtilities      R8,200\nParking        R3,000\nVAT            R9,480\n―――――――――――――――――\nTotal         R72,680\n\nStatus: Pending',
    w: 'w-44', h: 'h-28', x: 540, y: 40, rotate: '2deg', delay: '0.3s' 
  },
  { 
    name: 'Bank Feed', 
    icon: Landmark,
    content: '15 Jul  INV1024   +R52,000\n15 Jul  DEP884    +R18,000\n14 Jul  EFT442     -R7,500\n\nMatched: 2\nUnmatched: 1',
    w: 'w-36', h: 'h-22', x: 165, y: 160, rotate: '0deg', delay: '0.6s' 
  },
  { 
    name: 'Maintenance', 
    icon: Wrench,
    content: '● <span className="text-amber-400">#142 Blocked Drain</span>\n  Assigned — 2 days ago\n\n● #143 AC Repair\n  In Progress\n\n○ #144 Lift Service\n  Scheduled',
    w: 'w-52', h: 'h-26', x: 515, y: 235, rotate: '1deg', delay: '0.9s' 
  },
  { 
    name: 'Executive Report.pdf', 
    icon: FileText,
    content: 'Executive Summary\n\nNOI         ████████\nOccupancy   ██████\nRevenue     ████████\nArrears     <span className="text-amber-400">██</span>\n\nPortfolio Performance\n31 July 2026',
    w: 'w-44', h: 'h-24', x: 40, y: 350, rotate: '-2deg', delay: '1.2s' 
  },
  { 
    name: 'Tenant Inbox', 
    icon: Mail,
    content: 'Lease Renewal\nSandton Office — 09:41\n―――――――――――――――――\nInvoice Query\nRosebank Mall — Yesterday\n―――――――――――――――――\nMaintenance Update\nAlice Lane — Yesterday',
    w: 'w-44', h: 'h-24', x: 455, y: 390, rotate: '0deg', delay: '1.5s' 
  },
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
            Lease registers live in spreadsheets. Billing runs through legacy ERP. Payments happen in a bank portal. Maintenance lives in work order systems. Reporting is built manually. None of it is connected.
          </p>
        </div>

        <div className="relative h-[540px] md:h-[620px] max-w-3xl mx-auto" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 70%)' }}>
          
          {/* Dashed connection lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 640 520" style={{ opacity: 0.18 }}>
            <path d="M170 55 C210 70, 210 140, 240 170" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M560 90 C490 110, 440 140, 380 170" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M240 170 C280 210, 300 240, 350 280" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M540 280 C510 320, 490 370, 460 410" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M130 370 C230 380, 350 395, 460 410" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M360 150 C380 170, 370 200, 340 220" stroke="white" strokeWidth="0.6" strokeDasharray="2,8" strokeLinecap="round" fill="none" />
          </svg>

          {FRAGMENTED_APPS.map((app) => {
            const Icon = app.icon;
            return (
              <div
                key={app.name}
                className={`absolute animate-float rounded-xl border border-white/[0.1] bg-white/[0.05] backdrop-blur-sm px-4 py-3 shadow-lg shadow-black/30 ${app.w} ${app.h}`}
                style={{ left: app.x, top: app.y, transform: `rotate(${app.rotate})`, animationDelay: app.delay }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-[10px] text-zinc-400 font-light">{app.name}</span>
                </div>
                <div className="text-[10px] text-zinc-300 font-light leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: app.content }} />
              </div>
            );
          })}

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[11px] uppercase tracking-[0.5em] text-zinc-300 font-medium">Disconnected</p>
            <div className="mt-2 space-y-0.5">
              <div className="w-6 h-px bg-zinc-600" />
              <div className="w-4 h-px bg-zinc-700" />
              <div className="w-2 h-px bg-zinc-800" />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

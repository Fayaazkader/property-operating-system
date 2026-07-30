import { Container } from '../layout/Container';
import { Section } from '../layout/Section';
import { LeaseRegisterCard } from './shared-cards/LeaseRegisterCard';
import { BillingCard } from './shared-cards/BillingCard';
import { BankFeedCard } from './shared-cards/BankFeedCard';
import { MaintenanceCard } from './shared-cards/MaintenanceCard';
import { ExecutiveReportCard } from './shared-cards/ExecutiveReportCard';
import { TenantInboxCard } from './shared-cards/TenantInboxCard';

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

        <div className="relative h-[580px] md:h-[680px] max-w-3xl mx-auto" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 70%)' }}>
          
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 640 520" style={{ opacity: 0.18 }}>
            <path d="M170 55 C210 70, 210 140, 240 170" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M560 90 C490 110, 440 140, 380 170" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M240 170 C280 210, 300 240, 350 280" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M540 280 C510 320, 490 370, 460 410" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M130 370 C230 380, 350 395, 460 410" stroke="white" strokeWidth="0.8" strokeDasharray="4,6" strokeLinecap="round" fill="none" />
            <path d="M360 150 C380 170, 370 200, 340 220" stroke="white" strokeWidth="0.6" strokeDasharray="2,8" strokeLinecap="round" fill="none" />
          </svg>

          <LeaseRegisterCard />
          <BillingCard />
          <BankFeedCard />
          <MaintenanceCard />
          <ExecutiveReportCard />
          <TenantInboxCard />

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

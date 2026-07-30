import { Receipt } from 'lucide-react';

export function BillingCard() {
  return (
    <div className="absolute animate-float rounded-xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-sm p-5 shadow-lg shadow-black/30" style={{ left: 540, top: 40, width: 240, transform: 'rotate(2deg)', animationDelay: '0.3s' }}>
      <div className="flex items-center gap-2 mb-3">
        <Receipt className="w-3.5 h-3.5 text-blue-400/70" />
        <span className="text-[10px] text-zinc-400 font-light">Billing System</span>
      </div>
      <p className="text-[10px] text-zinc-500 mb-2">Invoice #INV-10482</p>
      <div className="space-y-1 text-[10px] font-light">
        <div className="flex justify-between text-zinc-300"><span>Rental</span><span>R52,000</span></div>
        <div className="flex justify-between text-zinc-300"><span>Utilities</span><span>R8,200</span></div>
        <div className="flex justify-between text-zinc-300"><span>Parking</span><span>R3,000</span></div>
        <div className="flex justify-between text-zinc-400"><span>VAT</span><span>R9,480</span></div>
        <div className="border-t border-white/[0.06] pt-1 flex justify-between text-white font-medium"><span>Total</span><span>R72,680</span></div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
        <span className="text-[10px] text-amber-400/80 font-light">Pending</span>
      </div>
    </div>
  );
}

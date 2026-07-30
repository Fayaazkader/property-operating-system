import Link from 'next/link';
import { marketing } from '@/lib/marketing.config';
import { Container } from '../layout/Container';

export function Footer() {
  return (
    <footer id="footer" className="border-t border-white/[0.04] bg-black py-16">
      <Container>
        <div className="grid gap-12 md:grid-cols-4">
          <div>
            <img src="/og-image.png" alt="AssetFlow" className="h-6 w-auto mb-2" />
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{marketing.company.tagline}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3">Product</p>
            <div className="space-y-2">
              {['Platform', 'Pricing', 'Resources'].map((item) => (
                <Link key={item} href={`/${item.toLowerCase()}`} className="block text-xs text-zinc-500 hover:text-white transition-colors">{item}</Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3">Company</p>
            <div className="space-y-2">
              {['About', 'Contact', 'LinkedIn'].map((item) => (
                <Link key={item} href={item === 'LinkedIn' ? marketing.socials.linkedin : `/${item.toLowerCase()}`} className="block text-xs text-zinc-500 hover:text-white transition-colors">{item}</Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-3">Legal</p>
            <div className="space-y-2">
              {['Privacy', 'Terms'].map((item) => (
                <Link key={item} href={`/${item.toLowerCase()}`} className="block text-xs text-zinc-500 hover:text-white transition-colors">{item}</Link>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-white/[0.04] text-center">
          <p className="text-[10px] text-zinc-600">{marketing.company.copyright}</p>
        </div>
      </Container>
    </footer>
  );
}

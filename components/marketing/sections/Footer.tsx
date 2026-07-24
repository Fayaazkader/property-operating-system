import Link from 'next/link';
import { marketing } from '@/lib/marketing.config';
import { Container } from '../layout/Container';

export function Footer() {
  return (
    <footer id="footer" className="border-t border-white/[0.04] bg-black py-12">
      <Container>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xs text-zinc-500">
            {marketing.company.copyright}
          </p>
          <div className="flex items-center gap-6">
            {marketing.navigation.main.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-xs text-zinc-500 hover:text-white transition-colors duration-200"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/contact" className="text-xs text-zinc-500 hover:text-white transition-colors duration-200">
              Contact
            </Link>
          </div>
        </div>
        <p className="text-center text-[10px] text-zinc-700 mt-8">
          {marketing.company.tagline}
        </p>
      </Container>
    </footer>
  );
}

import type { Metadata } from 'next';
import { ContactPageClient } from '@/components/marketing/sections/ContactPageClient';

export const metadata: Metadata = {
  title: 'Contact — Book a Demo',
  description: 'Book a personalised demo of AssetFlow. See how it connects your commercial property portfolio into one operating system.',
};

export default function ContactPage() {
  return <ContactPageClient />;
}

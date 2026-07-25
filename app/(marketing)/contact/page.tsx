import type { Metadata } from 'next';
import { ContactForm } from '@/components/marketing/sections/ContactForm';

export const metadata: Metadata = {
  title: 'Contact — Book a Demo',
  description: 'Book a personalised demo of AssetFlow. See how it connects your commercial property portfolio into one operating system.',
};

export default function ContactPage() {
  return <ContactForm />;
}

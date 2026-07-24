export const marketing = {
  company: {
    name: 'AssetFlow',
    tagline: 'The Operating System for Commercial Property',
    description: 'One platform for leases, billing, financials, and operations. Everything working as one.',
    email: 'hello@assetflow.africa',
    phone: '',
    linkedin: 'https://linkedin.com/company/assetflow',
    copyright: `© ${new Date().getFullYear()} AssetFlow. All rights reserved.`,
  },
  navigation: {
    main: [
      { label: 'Platform', href: '/platform' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Resources', href: '/resources' },
      { label: 'Company', href: '/company' },
    ],
    cta: { label: 'Book a Demo', href: '/contact' },
    login: { label: 'Sign In', href: '/login' },
  },
  socials: {
    linkedin: 'https://linkedin.com/company/assetflow',
  },
} as const;

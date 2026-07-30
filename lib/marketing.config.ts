export const marketing = {
  company: {
    name: 'AssetFlow',
    tagline: 'The Operating System for Commercial Property',
    description: 'From lease creation to revenue, finance, operations, and executive insight, AssetFlow connects every part of your commercial property portfolio into one intelligent operating system.',
    email: 'hello@assetflow.africa',
    phone: '',
    linkedin: 'https://www.linkedin.com/company/135154354',
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
    linkedin: 'https://www.linkedin.com/company/135154354',
  },
} as const;

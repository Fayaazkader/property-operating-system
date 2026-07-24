export const ROUTES = {
  HOME: '/',
  APP_HOME: '/app',
  LOGIN: '/login',
  PUBLIC: {
    LANDING: '/landing',
    ABOUT: '/about',
    SECURITY: '/security',
    CONTACT: '/contact',
    PRIVACY: '/privacy',
    TERMS: '/terms',
    PRICING: '/pricing',
    PLATFORM: '/platform',
    RESOURCES: '/resources',
    COMPANY: '/company',
  },
} as const;

export const PUBLIC_PREFIXES = [
  ROUTES.LOGIN,
  ...Object.values(ROUTES.PUBLIC),
] as const;

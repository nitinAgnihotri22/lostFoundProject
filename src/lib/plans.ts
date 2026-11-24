// Products, prices and plan limits – shared by the server and the browser.
// -------------------------------------------------------------------
// PAYMENTS ARE OFF: everything is free during launch. Prices are kept here
// (and shown struck through as "Free during launch") so that turning on
// payments later only needs:
//   1. PAYMENTS_ENABLED = true (or the env flag below),
//   2. a provider in src/lib/billing.ts → startOrder(),
//   3. a webhook route that marks payments 'paid' and calls the same
//      activateBoost() / activatePremium() functions used today.
// -------------------------------------------------------------------
import type { Category } from '@/types';

export const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

export type BoostPackage = 'local' | 'area' | 'city';

export interface BoostPackageInfo {
  id: BoostPackage;
  radiusKm: number;
  /** How long the item stays pinned at the top, in hours. */
  durationHours: number;
  /** How many alert rounds go out (spread over the duration). */
  rounds: number;
  /** List price in paise (₹1 = 100 paise). Not charged while payments are off. */
  pricePaise: number;
  product: string;
}

export const BOOST_PACKAGES: Record<BoostPackage, BoostPackageInfo> = {
  local: { id: 'local', radiusKm: 3, durationHours: 24, rounds: 1, pricePaise: 4900, product: 'boost_local' },
  area: { id: 'area', radiusKm: 10, durationHours: 72, rounds: 2, pricePaise: 14900, product: 'boost_area' },
  city: { id: 'city', radiusKm: 25, durationHours: 168, rounds: 3, pricePaise: 34900, product: 'boost_city' },
};
export const BOOST_PACKAGE_IDS = Object.keys(BOOST_PACKAGES) as BoostPackage[];

export type PremiumPeriod = 'monthly' | 'quarterly' | 'yearly';
export const PREMIUM_PRICES: Record<PremiumPeriod, { pricePaise: number; months: number; product: string }> = {
  monthly: { pricePaise: 9900, months: 1, product: 'premium_monthly' },
  quarterly: { pricePaise: 24900, months: 3, product: 'premium_quarterly' },
  yearly: { pricePaise: 79900, months: 12, product: 'premium_yearly' },
};

export type PlanId = 'free' | 'premium';

export interface PlanLimits {
  savedSearches: number;
  /** Largest radius allowed for a saved search's alerts. */
  maxAlertRadiusKm: number;
  /** true = push + email + in-app the moment a match is posted; false = daily digest. */
  instantMatchAlerts: boolean;
  hideAds: boolean;
  /** Boosts a person may start in any 30 days (abuse limit while boosts are free). */
  boostsPer30Days: number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { savedSearches: 1, maxAlertRadiusKm: 5, instantMatchAlerts: false, hideAds: false, boostsPer30Days: 3 },
  premium: { savedSearches: 5, maxAlertRadiusKm: 50, instantMatchAlerts: true, hideAds: true, boostsPer30Days: 4 },
};

/** Radius choices offered for saved searches (filtered by the plan's maximum). */
export const ALERT_RADII = [1, 2, 3, 5, 10, 25, 50];

/** Alerts about these go out first when someone's daily limit is reached. */
export const PRIORITY_CATEGORIES: Category[] = ['pets', 'documents'];

/** Hard cap on boost alerts per person per day (the plan's rule). */
export const MAX_BOOST_ALERTS_PER_DAY = 2;

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

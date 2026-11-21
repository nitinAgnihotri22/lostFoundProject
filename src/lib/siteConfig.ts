// Site-wide company and legal details.
// -------------------------------------------------------------------
// MOCK DATA: every value marked "TODO" is a placeholder. These are the
// defaults; a super admin can override them in /admin → Pages → Company
// details (saved in the site_settings table), which takes priority.
// -------------------------------------------------------------------

/** The part of the config a super admin can edit in /admin/pages (stored in site_settings). */
export interface SiteSettings {
  company: {
    legalName: string;
    cin: string;
    gstin: string;
    address: { line1: string; line2: string; city: string; state: string; postalCode: string; country: string };
  };
  contact: { email: string; phone: string; hours: { en: string; hi: string } };
  grievanceOfficer: { name: string; email: string; phone: string };
  accessibilityContactEmail: string;
  jurisdiction: { en: string; hi: string };
  legalLastUpdated: string;
}

export interface SiteConfig extends SiteSettings {
  name: string;
  url: string;
}

export const siteConfig: SiteConfig = {
  name: 'LostFound',
  /** Public URL, used by sitemap.xml, robots.txt and canonical links. */
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://lostfound.example.com').replace(/\/$/, ''),

  company: {
    legalName: 'LostFound Technologies Private Limited', // TODO
    cin: 'U00000MH2026PTC000000', // TODO: Corporate Identification Number
    gstin: '27AAAAA0000A1Z5', // TODO
    address: {
      line1: '101, Example Business Park', // TODO
      line2: 'Baner Road', // TODO
      city: 'Pune', // TODO
      state: 'Maharashtra', // TODO
      postalCode: '411045', // TODO
      country: 'India',
    },
  },

  contact: {
    email: 'support@lostfound.example.com', // TODO
    phone: '+91 20 0000 0000', // TODO
    hours: { en: 'Monday to Friday, 10:00 am to 6:00 pm IST', hi: 'सोमवार से शुक्रवार, सुबह 10:00 से शाम 6:00 बजे (IST)' },
  },

  /** Required under the IT Rules 2021 and the DPDP Act 2023. */
  grievanceOfficer: {
    name: 'Grievance Officer Name', // TODO
    email: 'grievance@lostfound.example.com', // TODO
    phone: '+91 20 0000 0001', // TODO
  },

  accessibilityContactEmail: 'accessibility@lostfound.example.com', // TODO

  /** Courts with exclusive jurisdiction under the Terms. */
  jurisdiction: { en: 'Pune, Maharashtra', hi: 'पुणे, महाराष्ट्र' }, // TODO

  /** Shown as "Last updated" on the legal pages. Update whenever the text changes. */
  legalLastUpdated: '2026-11-22',
};

export const formattedAddress = (c: SiteSettings = siteConfig) => {
  const a = c.company.address;
  return [a.line1, a.line2, a.city, `${a.state} ${a.postalCode}`.trim(), a.country].filter((p) => p && p.trim()).join(', ');
};

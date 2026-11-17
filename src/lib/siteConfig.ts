// Site-wide company and legal details.
// -------------------------------------------------------------------
// MOCK DATA: every value marked "TODO" is a placeholder. Replace them
// before launch – the Privacy Policy, Terms, Contact, About and
// Accessibility pages all read from here, so one edit updates them all.
// -------------------------------------------------------------------

export const siteConfig = {
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
  legalLastUpdated: '2026-11-18',
} as const;

export const formattedAddress = () => {
  const a = siteConfig.company.address;
  return `${a.line1}, ${a.line2}, ${a.city}, ${a.state} ${a.postalCode}, ${a.country}`;
};

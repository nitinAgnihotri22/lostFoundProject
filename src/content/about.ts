// About Us content. MOCK company details come from siteConfig.
import type { Lang } from '@/i18n/config';
import { siteConfig, type SiteSettings } from '@/lib/siteConfig';
import type { Doc } from './types';

export interface AboutContent {
  lead: string;
  steps: { title: string; body: string }[];
  stepsTitle: string;
  values: { title: string; body: string }[];
  valuesTitle: string;
  story: Doc;
  ctaTitle: string;
  ctaBody: string;
  ctaContact: string;
  ctaBrowse: string;
}

export function aboutContent(lang: Lang, c: SiteSettings = siteConfig): AboutContent {
  if (lang === 'hi') {
    return {
      lead: 'LostFound खोई हुई चीज़ों को उनके मालिकों तक पहुँचाने के लिए एक कम्युनिटी प्लेटफ़ॉर्म है। हम ईमानदार लोगों को आसान तरीका देते हैं, और 3 गुप्त प्रमाणों से यह पक्का करते हैं कि वस्तु सही व्यक्ति तक ही पहुँचे।',
      stepsTitle: 'यह कैसे काम करता है',
      steps: [
        { title: '1. मिली वस्तु दर्ज करें', body: 'फ़ोटो, स्थान और समय के साथ। पाने वाला 3 ऐसे प्रश्न तय करता है जिनका उत्तर केवल असली मालिक जानता है।' },
        { title: '2. मालिक दावा करता है', body: 'आस-पास के लोग नक्शे पर वस्तुएँ देखते हैं। मालिक उन 3 प्रश्नों के उत्तर निजी रूप से भेजता है।' },
        { title: '3. पुष्टि और वापसी', body: 'उत्तर मेल खाने पर पाने वाला दावा स्वीकार करता है, संपर्क विवरण साझा होते हैं, और दोनों सुरक्षित जगह पर मिलते हैं।' },
      ],
      valuesTitle: 'हमारे मूल्य',
      values: [
        { title: 'गोपनीयता पहले', body: 'संपर्क विवरण केवल दावा स्वीकार होने के बाद साझा होते हैं। हम आपका डेटा नहीं बेचते।' },
        { title: 'धोखाधड़ी से सुरक्षा', body: '3-प्रमाण सत्यापन फ़र्ज़ी दावों को रोकता है।' },
        { title: 'कम्युनिटी', body: 'हर लौटाई गई वस्तु पड़ोसियों के बीच भरोसा बढ़ाती है।' },
        { title: 'सबके लिए सुलभ', body: 'हिन्दी और अंग्रेज़ी में उपलब्ध, और हर पेज पर सुगम्यता सुविधाएँ।' },
      ],
      story: {
        sections: [
          { id: 'story', title: 'हमारी कहानी', blocks: [
            'हर दिन लाखों बटुए, फ़ोन, चाबियाँ और दस्तावेज़ खो जाते हैं। ज़्यादातर लोग उन्हें लौटाना चाहते हैं, पर नहीं जानते कि मालिक को कैसे ढूँढें, और यह डर भी रहता है कि वस्तु गलत व्यक्ति को न चली जाए।',
            `LostFound इसी समस्या को हल करने के लिए बनाया गया है। ${c.company.address.city} से शुरू होकर हम एक ऐसा नेटवर्क बना रहे हैं जहाँ मिली हुई हर वस्तु कुछ ही मिनटों में आस-पास के लोगों को दिख जाए।`,
          ] },
          { id: 'company', title: 'कंपनी', blocks: [
            { dl: [['कानूनी नाम', c.company.legalName], ['CIN', c.company.cin], ['मुख्यालय', `${c.company.address.city}, ${c.company.address.state}, भारत`]] },
          ] },
        ],
      },
      ctaTitle: 'कोई प्रश्न या सुझाव?',
      ctaBody: 'हम आपकी बात सुनना चाहते हैं – चाहे वह साझेदारी हो, कोई समस्या, या सुधार का सुझाव।',
      ctaContact: 'संपर्क करें',
      ctaBrowse: 'मिली वस्तुएँ देखें',
    };
  }

  return {
    lead: 'LostFound is a community platform that gets lost belongings back to their owners. We give honest finders a simple way to help, and use 3 secret proofs to make sure each item goes to the right person.',
    stepsTitle: 'How it works',
    steps: [
      { title: '1. Report a found item', body: 'With photos, location and time. The finder sets 3 questions only the real owner can answer.' },
      { title: '2. The owner claims it', body: 'People nearby see items on the map. The owner privately answers the 3 questions.' },
      { title: '3. Verify and return', body: 'If the answers match, the finder approves the claim, contact details are shared, and they meet somewhere safe.' },
    ],
    valuesTitle: 'What we stand for',
    values: [
      { title: 'Privacy first', body: 'Contact details are shared only after a claim is approved. We never sell your data.' },
      { title: 'Fraud protection', body: '3-proof verification stops fake claims.' },
      { title: 'Community', body: 'Every returned item builds trust between neighbours.' },
      { title: 'Accessible to all', body: 'Available in Hindi and English, with accessibility tools on every page.' },
    ],
    story: {
      sections: [
        { id: 'story', title: 'Our story', blocks: [
          'Every day, countless wallets, phones, keys and documents are lost. Most people who find them want to give them back, but do not know how to reach the owner – and worry about handing the item to the wrong person.',
          `LostFound was built to solve exactly that. Starting from ${c.company.address.city}, we are building a network where every found item is visible to people nearby within minutes.`,
        ] },
        { id: 'company', title: 'Company', blocks: [
          { dl: [['Legal name', c.company.legalName], ['CIN', c.company.cin], ['Headquarters', `${c.company.address.city}, ${c.company.address.state}, India`]] },
        ] },
      ],
    },
    ctaTitle: 'Questions or ideas?',
    ctaBody: 'We would love to hear from you – whether it is a partnership, a problem, or a way we could do better.',
    ctaContact: 'Contact us',
    ctaBrowse: 'Browse found items',
  };
}

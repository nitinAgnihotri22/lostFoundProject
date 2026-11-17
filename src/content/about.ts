// About Us and Accessibility Statement content. MOCK company details come from siteConfig.
import type { Lang } from '@/i18n/config';
import { siteConfig as c } from '@/lib/siteConfig';
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

export function aboutContent(lang: Lang): AboutContent {
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

export function accessibilityStatement(lang: Lang): Doc {
  const mail = c.accessibilityContactEmail;
  if (lang === 'hi') {
    return {
      intro: [
        'LostFound चाहता है कि हर व्यक्ति, किसी भी क्षमता के साथ, खोई हुई वस्तुएँ ढूँढ और लौटा सके। हम वेब कंटेंट एक्सेसिबिलिटी गाइडलाइंस (WCAG) 2.2 के स्तर AA, भारत सरकार के वेबसाइट दिशानिर्देश (GIGW 3.0) और दिव्यांगजन अधिकार अधिनियम 2016 का पालन करने का लक्ष्य रखते हैं।',
      ],
      sections: [
        { id: 'tools', title: 'हर पेज पर सुगम्यता उपकरण', blocks: [
          'स्क्रीन के नीचे बाईं ओर नीले बटन (या कीबोर्ड पर Alt + A) से सुगम्यता पैनल खोलें:',
          [
            'अक्षरों का आकार: 90% से 160% तक छोटा या बड़ा करें।',
            'रंग: उच्च कंट्रास्ट, रंग उलटें या ग्रेस्केल।',
            'पढ़कर सुनाएँ: पूरा पेज, चुना हुआ पाठ, या किसी भी पाठ पर क्लिक करके सुनें – हिन्दी और अंग्रेज़ी दोनों में।',
            'लिंक हाइलाइट करें, पढ़ने में आसान फ़ॉन्ट, और अक्षरों के बीच ज़्यादा जगह।',
            'एनिमेशन रोकें, बड़ा कर्सर, और चित्र छिपाएँ।',
          ],
          'आपकी सेटिंग इस ब्राउज़र में सेव रहती हैं और हर पेज पर लागू होती हैं।',
        ] },
        { id: 'built-in', title: 'वेबसाइट में शामिल सुविधाएँ', blocks: [
          [
            '"मुख्य सामग्री पर जाएँ" लिंक – हर पेज पर Tab दबाते ही दिखता है।',
            'पूरी वेबसाइट कीबोर्ड से चलाई जा सकती है, और फ़ोकस हमेशा साफ़ दिखता है।',
            'स्क्रीन रीडर के लिए बटन, फ़ॉर्म फ़ील्ड, डायलॉग और चित्रों के लेबल।',
            'हिन्दी और अंग्रेज़ी भाषा, सही भाषा टैग के साथ ताकि स्क्रीन रीडर सही उच्चारण करे।',
            'ब्राउज़र ज़ूम के साथ काम करता है, और डिवाइस की "कम एनिमेशन" सेटिंग का सम्मान करता है।',
          ],
        ] },
        { id: 'limitations', title: 'ज्ञात सीमाएँ', blocks: [
          [
            'नक्शा दृश्य माउस और टच के लिए बना है। वही सभी वस्तुएँ "कार्ड" दृश्य में सूची के रूप में भी उपलब्ध हैं।',
            'उपयोगकर्ताओं की अपलोड की गई फ़ोटो में हमेशा विस्तृत विवरण नहीं होता; वस्तु का शीर्षक और विवरण पाठ के रूप में उपलब्ध है।',
            'Google साइन इन और OpenStreetMap नक्शे जैसी बाहरी सेवाएँ हमारे नियंत्रण में नहीं हैं।',
            'पढ़कर सुनाने के लिए आपके डिवाइस में हिन्दी आवाज़ इंस्टॉल होनी चाहिए।',
          ],
        ] },
        { id: 'feedback', title: 'प्रतिक्रिया और सहायता', blocks: [
          `यदि आपको LostFound का कोई भाग उपयोग करने में कठिनाई होती है, तो कृपया ${mail} पर लिखें या संपर्क पेज पर "सुगम्यता से जुड़ी समस्या" चुनें। हम 5 कार्यदिवसों में जवाब देंगे और ज़रूरत हो तो जानकारी किसी दूसरे प्रारूप में देंगे।`,
        ] },
        { id: 'assessment', title: 'मूल्यांकन', blocks: [
          'यह विवरण LostFound टीम के स्वयं-मूल्यांकन पर आधारित है। स्क्रीन रीडर के साथ विस्तृत परीक्षण और बाहरी ऑडिट की योजना है, और हम हर बड़े बदलाव के बाद इसकी फिर से समीक्षा करते हैं।',
        ] },
      ],
    };
  }

  return {
    intro: [
      'LostFound wants everyone, whatever their abilities, to be able to find and return lost items. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA, the Guidelines for Indian Government Websites (GIGW 3.0), and the Rights of Persons with Disabilities Act, 2016.',
    ],
    sections: [
      { id: 'tools', title: 'Accessibility tools on every page', blocks: [
        'Open the accessibility panel with the blue button at the bottom left of the screen (or Alt + A on a keyboard):',
        [
          'Text size: make text smaller or larger, from 90% to 160%.',
          'Colours: high contrast, inverted colours or grayscale.',
          'Read aloud: the whole page, selected text, or click any text to hear it – in Hindi and English.',
          'Highlight links, a readable font, and wider text spacing.',
          'Stop animations, a large cursor, and hide images.',
        ],
        'Your settings are saved in this browser and apply on every page.',
      ] },
      { id: 'built-in', title: 'Built into the website', blocks: [
        [
          'A "Skip to main content" link that appears when you first press Tab on any page.',
          'The whole site works with a keyboard, and focus is always clearly visible.',
          'Labels for buttons, form fields, dialogs and images for screen readers.',
          'Hindi and English, with correct language tags so screen readers pronounce text properly.',
          'Works with browser zoom, and respects your device’s "reduce motion" setting.',
        ],
      ] },
      { id: 'limitations', title: 'Known limitations', blocks: [
        [
          'The map view is designed for mouse and touch. The same items are always available as a list in the "Cards" view.',
          'Photos uploaded by users do not always have detailed descriptions; the item title and description are available as text.',
          'Third-party services such as Google sign-in and OpenStreetMap maps are outside our control.',
          'Read aloud in Hindi needs a Hindi voice installed on your device.',
        ],
      ] },
      { id: 'feedback', title: 'Feedback and help', blocks: [
        `If you have trouble using any part of LostFound, please email ${mail} or choose "Accessibility issue" on the Contact page. We reply within 5 working days and can provide information in another format if you need it.`,
      ] },
      { id: 'assessment', title: 'How we assessed this', blocks: [
        // TODO: update once screen-reader testing (NVDA, VoiceOver, TalkBack) or an external audit has been done.
        'This statement is based on a self-assessment by the LostFound team. Full screen-reader testing and an external audit are planned, and we review this statement after every major change.',
      ] },
    ],
  };
}

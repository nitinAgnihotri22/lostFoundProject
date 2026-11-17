// Terms & Conditions – written for India (IT Act 2000, IT Intermediary Rules 2021).
// MOCK: company details come from src/lib/siteConfig.ts. Have a lawyer review before launch.
import type { Lang } from '@/i18n/config';
import { formattedAddress, siteConfig as c } from '@/lib/siteConfig';
import type { Doc } from './types';

export function termsOfService(lang: Lang): Doc {
  const co = c.company.legalName;
  const g = c.grievanceOfficer;

  if (lang === 'hi') {
    return {
      intro: [
        `ये नियम और शर्तें ("शर्तें") आपके और ${co} ("LostFound", "हम") के बीच एक कानूनी समझौता हैं। LostFound की वेबसाइट या ऐप का उपयोग करके आप इन शर्तों और हमारी गोपनीयता नीति से सहमत होते हैं। यदि आप सहमत नहीं हैं, तो कृपया LostFound का उपयोग न करें।`,
      ],
      sections: [
        { id: 'service', title: '1. LostFound क्या है', blocks: [
          'LostFound एक ऑनलाइन प्लेटफ़ॉर्म है जहाँ लोग मिली हुई वस्तुएँ दर्ज कर सकते हैं और असली मालिक 3 गुप्त प्रमाण देकर उन पर दावा कर सकते हैं।',
          'हम सूचना प्रौद्योगिकी अधिनियम 2000 के तहत एक "मध्यस्थ" (intermediary) हैं। हम कोई वस्तु अपने पास नहीं रखते, उसकी जाँच नहीं करते, और यह गारंटी नहीं देते कि कोई वस्तु या दावा असली है।',
        ] },
        { id: 'eligibility', title: '2. पात्रता', blocks: [
          'LostFound का उपयोग करने के लिए आपकी उम्र कम से कम 18 वर्ष होनी चाहिए, या आपको माता-पिता या कानूनी अभिभावक की सहमति होनी चाहिए।',
        ] },
        { id: 'account', title: '3. आपका खाता', blocks: [
          [
            'सही और अपडेट जानकारी दें।',
            'अपना पासवर्ड गोपनीय रखें। आपके खाते से होने वाली हर गतिविधि के लिए आप ज़िम्मेदार हैं।',
            'किसी और के नाम से खाता न बनाएँ।',
          ],
        ] },
        { id: 'posting', title: '4. मिली वस्तु दर्ज करना', blocks: [
          'जब आप कोई मिली वस्तु दर्ज करते हैं, तो आप सहमत होते हैं कि:',
          [
            'आपके पास वस्तु सच में है और विवरण सही है।',
            'फ़ोटो आपकी खींची हुई हैं या आपको उन्हें इस्तेमाल करने का अधिकार है।',
            'आप गुप्त पहचान चिह्न (सीरियल नंबर, अंदर रखा सामान आदि) सार्वजनिक विवरण में नहीं लिखेंगे, ताकि केवल असली मालिक ही उन्हें बता सके।',
            'पहचान पत्र, पासपोर्ट, नकदी, हथियार या संभावित चोरी की वस्तुएँ जहाँ कानून कहता है, वहाँ आप नज़दीकी पुलिस स्टेशन में जमा करेंगे।',
            'आप वस्तु लौटाने के बदले पैसे या इनाम की माँग नहीं करेंगे।',
          ],
        ] },
        { id: 'claims', title: '5. दावे और वस्तु सौंपना', blocks: [
          [
            'केवल असली मालिक ही दावा कर सकता है। झूठा दावा करना धोखाधड़ी है और कानूनन अपराध हो सकता है।',
            'पोस्ट करने वाला प्रमाणों की जाँच करके दावा स्वीकार या अस्वीकार करने के लिए स्वतंत्र है। हम इस निर्णय में शामिल नहीं होते।',
            'वस्तु सौंपते समय किसी सुरक्षित, सार्वजनिक जगह पर मिलें और पहचान पत्र देखें।',
            'मालिक की ओर से दिया गया कोई भी इनाम स्वैच्छिक है और दोनों उपयोगकर्ताओं के बीच का मामला है।',
          ],
        ] },
        { id: 'prohibited', title: '6. वर्जित आचरण', blocks: [
          'आप ऐसा नहीं करेंगे:',
          [
            'झूठी, भ्रामक या फ़र्ज़ी रिपोर्ट या दावे पोस्ट करना।',
            'किसी को परेशान करना, धमकाना या पैसे वसूलना।',
            'अश्लील, अपमानजनक, नफ़रत फैलाने वाली या गैरकानूनी सामग्री पोस्ट करना।',
            'दूसरों की व्यक्तिगत जानकारी उनकी अनुमति के बिना साझा करना।',
            'स्पैम, विज्ञापन या मैलवेयर भेजना, या प्लेटफ़ॉर्म को हैक करने या उसका डेटा स्क्रैप करने की कोशिश करना।',
            'आईटी नियम 2021 के नियम 3(1)(b) में बताई गई कोई भी सामग्री पोस्ट करना।',
          ],
        ] },
        { id: 'content', title: '7. आपकी सामग्री', blocks: [
          'आपकी पोस्ट की गई फ़ोटो और विवरण आपके ही रहते हैं। आप हमें इन्हें LostFound पर दिखाने, आकार बदलने और वस्तु को उसके मालिक तक पहुँचाने के उद्देश्य से साझा करने का गैर-अनन्य, निःशुल्क लाइसेंस देते हैं। रिपोर्ट हटाने पर यह लाइसेंस समाप्त हो जाता है।',
        ] },
        { id: 'takedown', title: '8. सामग्री हटाना', blocks: [
          'हम इन शर्तों या कानून का उल्लंघन करने वाली किसी भी सामग्री को बिना सूचना के हटा सकते हैं। सरकार या अदालत के आदेश पर हम आईटी नियम 2021 में तय समय-सीमा में सामग्री हटाएँगे। आप किसी भी सामग्री की शिकायत नीचे दिए शिकायत अधिकारी से कर सकते हैं।',
        ] },
        { id: 'safety', title: '9. सुरक्षा', blocks: [
          'LostFound उपयोगकर्ताओं की पहचान या वस्तुओं की असलियत की गारंटी नहीं देता। किसी से मिलते समय, पैसे के लेन-देन में, या निजी जानकारी साझा करते समय सावधानी बरतें। ऐप की चैट में कभी भी पासवर्ड, OTP या भुगतान विवरण साझा न करें।',
        ] },
        { id: 'liability', title: '10. अस्वीकरण और दायित्व की सीमा', blocks: [
          'LostFound "जैसा है" और "जैसा उपलब्ध है" आधार पर दिया जाता है। कानून द्वारा अनुमत अधिकतम सीमा तक, हम किसी खोई, क्षतिग्रस्त या गलत व्यक्ति को सौंपी गई वस्तु, उपयोगकर्ताओं के आपसी विवाद, या अप्रत्यक्ष नुकसान के लिए ज़िम्मेदार नहीं हैं। किसी भी स्थिति में हमारा कुल दायित्व ₹1,000 से अधिक नहीं होगा।',
        ] },
        { id: 'indemnity', title: '11. क्षतिपूर्ति', blocks: [
          'यदि आपकी सामग्री या इन शर्तों के उल्लंघन के कारण हम पर कोई दावा होता है, तो आप उससे होने वाले नुकसान और खर्च की भरपाई करने के लिए सहमत हैं।',
        ] },
        { id: 'termination', title: '12. खाता बंद करना', blocks: [
          'आप कभी भी अपना खाता बंद कर सकते हैं। इन शर्तों का उल्लंघन करने पर हम आपका खाता निलंबित या बंद कर सकते हैं।',
        ] },
        { id: 'law', title: '13. लागू कानून और क्षेत्राधिकार', blocks: [
          `ये शर्तें भारत के कानूनों द्वारा शासित हैं। किसी भी विवाद पर ${c.jurisdiction.hi} की अदालतों का विशेष क्षेत्राधिकार होगा।`,
        ] },
        { id: 'changes', title: '14. इन शर्तों में बदलाव', blocks: [
          'हम इन शर्तों को समय-समय पर बदल सकते हैं। बदलाव के बाद LostFound का उपयोग जारी रखने का अर्थ है कि आप नई शर्तें स्वीकार करते हैं।',
        ] },
        { id: 'contact', title: '15. संपर्क और शिकायत अधिकारी', blocks: [
          { dl: [['कंपनी', co], ['पता', formattedAddress()], ['ईमेल', c.contact.email], ['शिकायत अधिकारी', `${g.name} – ${g.email}`]] },
        ] },
      ],
    };
  }

  return {
    intro: [
      `These Terms & Conditions ("Terms") are a legal agreement between you and ${co} ("LostFound", "we", "us"). By using the LostFound website or app you agree to these Terms and our Privacy Policy. If you do not agree, please do not use LostFound.`,
    ],
    sections: [
      { id: 'service', title: '1. What LostFound is', blocks: [
        'LostFound is an online platform where people report items they have found, and the true owners claim them by answering 3 secret proofs.',
        'We are an "intermediary" under the Information Technology Act, 2000. We do not hold, inspect or verify any item, and we do not guarantee that any item or claim is genuine.',
      ] },
      { id: 'eligibility', title: '2. Eligibility', blocks: [
        'You must be at least 18 years old to use LostFound, or have the consent of a parent or legal guardian.',
      ] },
      { id: 'account', title: '3. Your account', blocks: [
        [
          'Give accurate, up-to-date information.',
          'Keep your password secret. You are responsible for everything done with your account.',
          'Do not create an account in someone else’s name.',
        ],
      ] },
      { id: 'posting', title: '4. Reporting a found item', blocks: [
        'When you report a found item, you agree that:',
        [
          'You really have the item and the description is accurate.',
          'You took the photos or have the right to use them.',
          'You will not put secret identifying marks (serial numbers, contents, etc.) in the public description, so only the real owner can name them.',
          'Where the law requires it, you will hand identity documents, passports, cash, weapons or possibly stolen items to the nearest police station.',
          'You will not demand money or a reward in exchange for returning the item.',
        ],
      ] },
      { id: 'claims', title: '5. Claims and handover', blocks: [
        [
          'Only the true owner may make a claim. A false claim is fraud and may be a criminal offence.',
          'The poster decides whether to approve or reject a claim after checking the proofs. We are not part of that decision.',
          'Meet in a safe, public place for the handover and check identification.',
          'Any reward offered by the owner is voluntary and a matter between the two users.',
        ],
      ] },
      { id: 'prohibited', title: '6. Prohibited conduct', blocks: [
        'You will not:',
        [
          'Post false, misleading or fake reports or claims.',
          'Harass, threaten or extort anyone.',
          'Post obscene, defamatory, hateful or unlawful content.',
          'Share other people’s personal information without their permission.',
          'Send spam, advertising or malware, or try to hack the platform or scrape its data.',
          'Post any content described in Rule 3(1)(b) of the IT Rules 2021.',
        ],
      ] },
      { id: 'content', title: '7. Your content', blocks: [
        'Photos and descriptions you post remain yours. You give us a non-exclusive, royalty-free licence to display them on LostFound, resize them, and share them for the purpose of returning the item to its owner. The licence ends when you delete the report.',
      ] },
      { id: 'takedown', title: '8. Removing content', blocks: [
        'We may remove any content that breaks these Terms or the law without notice. On a government or court order we remove content within the timelines in the IT Rules 2021. You can report any content to the Grievance Officer below.',
      ] },
      { id: 'safety', title: '9. Safety', blocks: [
        'LostFound does not guarantee who users are or that items are genuine. Take care when meeting anyone, handling money or sharing personal information. Never share passwords, OTPs or payment details in the app chat.',
      ] },
      { id: 'liability', title: '10. Disclaimer and limitation of liability', blocks: [
        'LostFound is provided "as is" and "as available". To the maximum extent the law allows, we are not liable for items that are lost, damaged or handed to the wrong person, for disputes between users, or for indirect losses. Our total liability will never exceed ₹1,000.',
      ] },
      { id: 'indemnity', title: '11. Indemnity', blocks: [
        'You agree to cover our losses and costs if a claim is made against us because of your content or your breach of these Terms.',
      ] },
      { id: 'termination', title: '12. Closing an account', blocks: [
        'You may close your account at any time. We may suspend or close your account if you break these Terms.',
      ] },
      { id: 'law', title: '13. Governing law and jurisdiction', blocks: [
        `These Terms are governed by the laws of India. The courts of ${c.jurisdiction.en} have exclusive jurisdiction over any dispute.`,
      ] },
      { id: 'changes', title: '14. Changes to these Terms', blocks: [
        'We may change these Terms from time to time. Continuing to use LostFound after a change means you accept the new Terms.',
      ] },
      { id: 'contact', title: '15. Contact and Grievance Officer', blocks: [
        { dl: [['Company', co], ['Address', formattedAddress()], ['Email', c.contact.email], ['Grievance Officer', `${g.name} – ${g.email}`]] },
      ] },
    ],
  };
}

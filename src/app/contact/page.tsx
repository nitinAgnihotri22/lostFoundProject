import type { Metadata } from 'next';
import { Clock, Mail, MapPin, Phone, UserCheck } from 'lucide-react';
import ContentPage from '@/components/ContentPage';
import ContactForm from '@/components/ContactForm';
import { getServerT } from '@/i18n/server';
import { formattedAddress, siteConfig as c } from '@/lib/siteConfig';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t('pages.contactTitle'), description: t('pages.contactDesc'), alternates: { canonical: '/contact' } };
}

export default async function ContactPage() {
  const { lang, t } = await getServerT();
  const g = c.grievanceOfficer;
  const row = 'flex items-start gap-3';
  const icon = 'w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0';

  return (
    <ContentPage title={t('pages.contactTitle')} description={t('contact.intro')} mockNotice>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ContactForm />

        <aside className="space-y-4">
          <section aria-labelledby="reach-us" className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 id="reach-us" className="text-base font-black text-gray-900 mb-4">{t('contact.reachUs')}</h2>
            <dl className="space-y-4 text-sm">
              <div className={row}>
                <span className={icon}><Mail className="w-4 h-4" /></span>
                <div>
                  <dt className="font-bold text-gray-800">{t('contact.email')}</dt>
                  <dd><a href={`mailto:${c.contact.email}`} className="text-blue-700 underline underline-offset-2 break-all">{c.contact.email}</a></dd>
                </div>
              </div>
              <div className={row}>
                <span className={icon}><Phone className="w-4 h-4" /></span>
                <div>
                  <dt className="font-bold text-gray-800">{t('contact.phone')}</dt>
                  <dd><a href={`tel:${c.contact.phone.replace(/\s/g, '')}`} className="text-blue-700 underline underline-offset-2">{c.contact.phone}</a></dd>
                </div>
              </div>
              <div className={row}>
                <span className={icon}><Clock className="w-4 h-4" /></span>
                <div>
                  <dt className="font-bold text-gray-800">{t('contact.hours')}</dt>
                  <dd className="text-gray-700">{c.contact.hours[lang]}</dd>
                </div>
              </div>
              <div className={row}>
                <span className={icon}><MapPin className="w-4 h-4" /></span>
                <div>
                  <dt className="font-bold text-gray-800">{t('contact.address')}</dt>
                  <dd className="text-gray-700"><address className="not-italic">{c.company.legalName}<br />{formattedAddress()}</address></dd>
                </div>
              </div>
            </dl>
          </section>

          <section aria-labelledby="grievance" className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 id="grievance" className="text-base font-black text-gray-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-700" /> {t('contact.grievance')}
            </h2>
            <p className="mt-1 text-xs text-gray-600">{t('contact.grievanceNote')}</p>
            <p className="mt-3 text-sm text-gray-800 font-semibold">{g.name}</p>
            <p className="text-sm"><a href={`mailto:${g.email}`} className="text-blue-700 underline underline-offset-2 break-all">{g.email}</a></p>
            <p className="text-sm"><a href={`tel:${g.phone.replace(/\s/g, '')}`} className="text-blue-700 underline underline-offset-2">{g.phone}</a></p>
          </section>
        </aside>
      </div>
    </ContentPage>
  );
}

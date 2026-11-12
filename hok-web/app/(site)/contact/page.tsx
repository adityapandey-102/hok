import type { Metadata } from "next";
import { ContactForm } from "@/modules/site/components/ContactForm";
import { PageBanner } from "@/modules/site/components/PageBanner";
import { SignalMotif } from "@/modules/site/components/SignalMotif";
import { SitePage } from "@/modules/site/components/SitePage";
import { CONTACT, MARKETS_SHORT, PAGE_INTROS, PHONE_HREF, SOCIALS, STOCK } from "@/modules/site/content";

export const metadata: Metadata = { title: "Contact" };

const ICON = { fill: "none", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" } as const;

/** The three channels: a round line icon, a muted label and a white value. */
const CHANNELS: { label: string; value: string; href: string; external?: boolean; icon: React.ReactNode }[] = [
  {
    label: "Call or WhatsApp",
    value: CONTACT.phone,
    href: PHONE_HREF,
    icon: (
      <svg viewBox="0 0 24 24" {...ICON}>
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
      </svg>
    ),
  },
  {
    label: "Email",
    value: CONTACT.email,
    href: `mailto:${CONTACT.email}`,
    icon: (
      <svg viewBox="0 0 24 24" {...ICON}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    value: "@hok.co_",
    href: SOCIALS.instagram,
    external: true,
    icon: (
      <svg viewBox="0 0 24 24" {...ICON}>
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="3.6" />
        <circle cx="16.8" cy="7.2" r=".6" />
      </svg>
    ),
  },
];

/** Contact: an info panel (photo, three channels, the studio) on the left, the enquiry form on a gradient-bordered panel on the right. On a phone the form comes first. */
export default function ContactPage() {
  return (
    <SitePage variant="inner">
      <main className="main" id="mains">
        <PageBanner intro={PAGE_INTROS.contact} />
        <section className="hok-section hok-section--page hok-section--end hok-contact">
          <div className="container">
            <div className="hok-contact__grid">
              <aside className="hok-info" data-reveal="up" aria-label="Contact details">
                <div className="hok-info__photo">
                  <img src={STOCK.contact} alt="" width={1600} height={1067} sizes="(min-width: 992px) 42vw, 100vw" loading="lazy" decoding="async" />
                  <h3 className="hok-info__title">Let’s talk over coffee or a call.</h3>
                </div>
                <div className="hok-info__body">
                  <ul className="hok-channels">
                    {CHANNELS.map((c) => (
                      <li key={c.label}>
                        <a href={c.href} className="hok-channel" {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                          <span className="hok-channel__icon">{c.icon}</span>
                          <span className="hok-channel__text">
                            <span className="hok-channel__label">{c.label}</span>
                            <span className="hok-channel__value">{c.value}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                  <div className="hok-studio">
                    <p>{CONTACT.address}</p>
                    <p>{CONTACT.hours}</p>
                    <p>Markets: {MARKETS_SHORT}</p>
                  </div>
                </div>
                <SignalMotif id="hk-dots-info" className="hok-motif--info" />
              </aside>
              <div className="hok-contact__form" data-reveal="up">
                <ContactForm variant="page" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </SitePage>
  );
}

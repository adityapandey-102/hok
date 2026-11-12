import type { Metadata } from "next";
import { PageBanner } from "@/modules/site/components/PageBanner";
import { REVEAL } from "@/modules/site/components/SectionHead";
import { SitePage } from "@/modules/site/components/SitePage";
import { CONTACT, PAGE_INTROS, PHONE_HREF, SOCIALS } from "@/modules/site/content";

export const metadata: Metadata = { title: "Contact" };

const DETAILS: { label: string; value: string; href?: string }[] = [
  { label: "Phone", value: CONTACT.phone, href: PHONE_HREF },
  { label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
  { label: "Address", value: CONTACT.address },
  { label: "Hours", value: CONTACT.hours },
];

/** Contact: the four details as label and value, the social links, and the message form. */
export default function ContactPage() {
  return (
    <SitePage variant="inner">
      <main className="main" id="mains">
        <PageBanner intro={PAGE_INTROS.contact} />
        <section className="hok-section hok-section--page hok-section--end hok-contact">
          <div className="container">
            <dl className="hok-details" {...REVEAL}>
              {DETAILS.map((d) => (
                <div key={d.label} className="hok-detail">
                  <dt>{d.label}</dt>
                  <dd>{d.href ? <a href={d.href}>{d.value}</a> : d.value}</dd>
                </div>
              ))}
            </dl>
            <div className="hok-contact__grid" {...REVEAL}>
              <div className="hok-contact__side">
                <h2 className="hok-contact__h">Follow HOK</h2>
                <p className="hok-lead">See our latest campaigns and reels.</p>
                <ul className="hok-textlinks">
                  <li>
                    <a href={SOCIALS.instagram} target="_blank" rel="noopener noreferrer">
                      Instagram
                    </a>
                  </li>
                  <li>
                    <a href={SOCIALS.linkedin} target="_blank" rel="noopener noreferrer">
                      LinkedIn
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h2 className="hok-contact__h">Leave A Message</h2>
                <form action="#" className="hok-form">
                  <div className="hok-form__row">
                    <input type="text" name="name" placeholder="Name" aria-label="Name" />
                    <input type="email" name="email" placeholder="Email" aria-label="Email" />
                  </div>
                  <input type="tel" name="phone" placeholder="Phone" aria-label="Phone" />
                  <textarea name="messages" rows={5} placeholder="Message" aria-label="Message" />
                  <div>
                    <button type="submit" className="hok-btn hok-btn--primary">
                      Send Message
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
    </SitePage>
  );
}

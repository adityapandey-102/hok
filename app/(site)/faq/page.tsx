import type { Metadata } from "next";
import { SitePage } from "@/modules/site/components/SitePage";
import { SiteIcon } from "@/modules/site/components/SiteIcon";

/** Ported as-is from the HOK template's `faq.html` (see README "Portfolio"). */
export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <SitePage variant="inner">
      <main className="main">
        {/* Breadcrumnd Banner */}
        <section className="breadcrumnd-banner position-relative">
          <div className="container">
            <div className="row g-5 justify-content-center">
              <div className="col-lg-5">
                <div className="breadcrumnd-content text-center">
                  <h1 className="white mb-xxl-10 mb-xl-8 mb-6" data-aos="zoom-in-left" data-aos-duration="1800">FAQ’S</h1>
                  <ul className="breadcrumnd d-inline-flex align-items-center gap-2 pra-border radius100 py-xxl-3 py-2 px-xxl-4 px-4" data-aos="zoom-in-right" data-aos-duration="2000">
                    <li>
                      <a href="/" className="text-uppercase htheme">Home</a>
                    </li>
                    <li>
                      <span className="rot60 d-inline-block">
                        <SiteIcon name="arrow-up" />
                      </span>
                    </li>
                    <li className="theme-clr">FAQ’S</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          {/* Element */}
          <img src="/site/assets/img/element/cmn-dost.png" alt="img" className="cmn-dots" />
          <div className="cmn-svg-shape cmn-svg">
            <svg width="211" height="211" viewBox="0 0 211 211" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M153.353 98.3617V190.413H210V1H20.5872V57.6468H112.638L2 168.285L42.7149 209L153.353 98.3617Z" stroke="url(#paint0_linear_6584_3026)" strokeWidth="2" />
              <defs>
                <linearGradient id="paint0_linear_6584_3026" x1="416.867" y1="-216.267" x2="8.49998" y2="192.1" gradientUnits="userSpaceOnUse">
                  <stop offset="2" stopColor="#E3FF04" />
                  <stop offset="1" stopColor="#FF7425" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </section>
        {/* Breadcrumnd Banner */}
        {/* Faqs Start */}
        <section className="Faqs-section pt-space pb-space">
          <div className="container">
            <div className="faqs-title text-center mb-xxl-15 mb-xl-12 mb-lg-10 mb-md-9 mb-sm-8 mb-7">
              <a href="/blog/details" className="radius-btn cmn-border d-inline-flex radius100 py-xxl-2 py-2 px-xxl-4 px-4 theme-clr gap-xxl-4 gap-3 mb-xxl-8 mb-xl-6 mb-5">
                FAQ’S
                {" "}
                <span className="rot60 d-inline-block">
                  <SiteIcon name="arrow-up" className="theme-clr" />
                </span>
              </a>
              <h2 className="stitle">
                Frequently asked
                {" "}
                <span className="fw-400">questions</span>
              </h2>
            </div>
            <div className="row g-xxl-7 g-lg-6 g-0 justify-content-center">
              <div className="col-lg-6">
                <div className="faq">
                  <div className="accordion-section">
                    <div className="accordion-single mb-xxl-4 mb-4 py-xxl-7 py-xl-6 py-lg-4 py-3 px-xxl-8 px-xl-7 px-lg-6 px-4">
                      <h5 className="header-area">
                        <button className="accordion-btn d-flex align-items-center text-start d-flex position-relative w-100" type="button">How long should a business plan be?</button>
                      </h5>
                      <div className="content-area">
                        <div className="content-body pt-4">
                          <p className="pra-clr">
                            Nullam faucibus eleifend mi eu varius. Integer vel tincidunt massa, quis semper odio. Mauris et mollis quam. Nullam fringilla erat id ante commodo sodales. In maximus ultrices euismod. Vivamus porta justo ex.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="accordion-single mb-xxl-4 mb-4 py-xxl-7 py-xl-6 py-lg-4 py-3 px-xxl-8 px-xl-7 px-lg-6 px-4">
                      <h5 className="header-area">
                        <button className="accordion-btn d-flex align-items-center text-start d-flex position-relative w-100" type="button">What is included in your services?</button>
                      </h5>
                      <div className="content-area">
                        <div className="content-body pt-4">
                          <p className="pra-clr">
                            Nullam faucibus eleifend mi eu varius. Integer vel tincidunt massa, quis semper odio. Mauris et mollis quam. Nullam fringilla erat id ante commodo sodales. In maximus ultrices euismod. Vivamus porta justo ex.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="accordion-single mb-xxl-4 mb-4 py-xxl-7 py-xl-6 py-lg-4 py-3 px-xxl-8 px-xl-7 px-lg-6 px-4">
                      <h5 className="header-area">
                        <button className="accordion-btn d-flex align-items-center text-start d-flex position-relative w-100" type="button">What type of company is measured?</button>
                      </h5>
                      <div className="content-area">
                        <div className="content-body pt-4">
                          <p className="pra-clr">
                            Nullam faucibus eleifend mi eu varius. Integer vel tincidunt massa, quis semper odio. Mauris et mollis quam. Nullam fringilla erat id ante commodo sodales. In maximus ultrices euismod. Vivamus porta justo ex.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="accordion-single mb-xxl-4 mb-4 py-xxl-7 py-xl-6 py-lg-4 py-3 px-xxl-8 px-xl-7 px-lg-6 px-4">
                      <h5 className="header-area">
                        <button className="accordion-btn d-flex align-items-center text-start d-flex position-relative w-100" type="button">What type of company is measured?</button>
                      </h5>
                      <div className="content-area">
                        <div className="content-body pt-4">
                          <p className="pra-clr">
                            Nullam faucibus eleifend mi eu varius. Integer vel tincidunt massa, quis semper odio. Mauris et mollis quam. Nullam fringilla erat id ante commodo sodales. In maximus ultrices euismod. Vivamus porta justo ex.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="faq">
                  <div className="accordion-section">
                    <div className="accordion-single mb-xxl-4 mb-4 py-xxl-7 py-xl-6 py-lg-4 py-3 px-xxl-8 px-xl-7 px-lg-6 px-4">
                      <h5 className="header-area">
                        <button className="accordion-btn d-flex align-items-center text-start d-flex position-relative w-100" type="button">How long should a business plan be?</button>
                      </h5>
                      <div className="content-area">
                        <div className="content-body pt-4">
                          <p className="pra-clr">
                            Nullam faucibus eleifend mi eu varius. Integer vel tincidunt massa, quis semper odio. Mauris et mollis quam. Nullam fringilla erat id ante commodo sodales. In maximus ultrices euismod. Vivamus porta justo ex.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="accordion-single mb-xxl-4 mb-4 py-xxl-7 py-xl-6 py-lg-4 py-3 px-xxl-8 px-xl-7 px-lg-6 px-4">
                      <h5 className="header-area">
                        <button className="accordion-btn d-flex align-items-center text-start d-flex position-relative w-100" type="button">What is included in your services?</button>
                      </h5>
                      <div className="content-area">
                        <div className="content-body pt-4">
                          <p className="pra-clr">
                            Nullam faucibus eleifend mi eu varius. Integer vel tincidunt massa, quis semper odio. Mauris et mollis quam. Nullam fringilla erat id ante commodo sodales. In maximus ultrices euismod. Vivamus porta justo ex.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="accordion-single mb-xxl-4 mb-4 py-xxl-7 py-xl-6 py-lg-4 py-3 px-xxl-8 px-xl-7 px-lg-6 px-4">
                      <h5 className="header-area">
                        <button className="accordion-btn d-flex align-items-center text-start d-flex position-relative w-100" type="button">What type of company is measured?</button>
                      </h5>
                      <div className="content-area">
                        <div className="content-body pt-4">
                          <p className="pra-clr">
                            Nullam faucibus eleifend mi eu varius. Integer vel tincidunt massa, quis semper odio. Mauris et mollis quam. Nullam fringilla erat id ante commodo sodales. In maximus ultrices euismod. Vivamus porta justo ex.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="accordion-single mb-xxl-4 mb-4 py-xxl-7 py-xl-6 py-lg-4 py-3 px-xxl-8 px-xl-7 px-lg-6 px-4">
                      <h5 className="header-area">
                        <button className="accordion-btn d-flex align-items-center text-start d-flex position-relative w-100" type="button">What type of company is measured?</button>
                      </h5>
                      <div className="content-area">
                        <div className="content-body pt-4">
                          <p className="pra-clr">
                            Nullam faucibus eleifend mi eu varius. Integer vel tincidunt massa, quis semper odio. Mauris et mollis quam. Nullam fringilla erat id ante commodo sodales. In maximus ultrices euismod. Vivamus porta justo ex.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Faqs End */}
      </main>
    </SitePage>
  );
}

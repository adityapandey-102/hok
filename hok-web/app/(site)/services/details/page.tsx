import type { Metadata } from "next";
import { SitePage } from "@/modules/site/components/SitePage";
import { SiteIcon } from "@/modules/site/components/SiteIcon";

/** Ported as-is from the HOK template's `service-details.html` (see README "Portfolio"). */
export const metadata: Metadata = { title: "Service details" };

export default function ServiceDetailsPage() {
  return (
    <SitePage variant="inner">
      <main className="main">
        {/* Breadcrumnd Banner */}
        <section className="breadcrumnd-banner position-relative">
          <div className="container">
            <div className="row g-5 justify-content-center">
              <div className="col-lg-7">
                <div className="breadcrumnd-content text-center">
                  <h1 className="white mb-xxl-10 mb-xl-8 mb-6" data-aos="zoom-in-left" data-aos-duration="1800">Services Details</h1>
                  <ul className="breadcrumnd d-inline-flex align-items-center gap-2 pra-border radius100 py-xxl-3 py-2 px-xxl-4 px-4" data-aos="zoom-in-right" data-aos-duration="2000">
                    <li>
                      <a href="/" className="text-uppercase htheme">Home</a>
                    </li>
                    <li>
                      <span className="rot60 d-inline-block">
                        <SiteIcon name="arrow-up" />
                      </span>
                    </li>
                    <li className="theme-clr">Services Details</li>
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
        {/* Service Details Start */}
        <section className="Service-details pt-space pb-space">
          <div className="container">
            <div className="service-details-header bb-border pb-xxl-9 pb-xl-7 pb-6">
              <div className="thumb w-100 mb-xxl-12 mb-xl-9 mb-sm-6 mb-5" data-aos="zoom-in" data-aos-duration="1500">
                <img src="/site/assets/img/blog/project-slide2.jpg" alt="img" className="w-100" />
              </div>
              <h3 className="white-clr mb-xxl-9 mb-xl-7 mb-lg-6 mb-4" data-aos="zoom-in-left" data-aos-duration="1600">World best web design service provider.</h3>
              <div className="d-flex flex-wrap align-items-center gap-xxl-5 gap-xl-3 gap-2" data-aos="zoom-in-left" data-aos-duration="1800">
                <a href="/services/details" className="radius-btn cmn-border radius100 py-xxl-2 py-2 px-xxl-4 px-3 theme-clr">Creative</a>
                {" "}
                <a href="/services/details" className="radius-btn cmn-border radius100 py-xxl-2 py-2 px-xxl-4 px-3 theme-clr">Branding</a>
                {" "}
                <a href="/services/details" className="radius-btn cmn-border radius100 py-xxl-2 py-2 px-xxl-4 px-3 theme-clr">Analytics</a>
                {" "}
                <a href="/services/details" className="radius-btn cmn-border radius100 py-xxl-2 py-2 px-xxl-4 px-3 theme-clr">Audience</a>
              </div>
            </div>
            <div className="case-study-detials-inner mt-xxl-10 mt-xl-7 mt-6">
              <h4 className="mb-xxl-7 mb-4 white-clr">Service Overview</h4>
              <div className="d-flex flex-md-nowrap flex-wrap justify-content-between gap-xxl-15 gap-xl-10 gap-lg-7 gap-sm-5 gap-3 mb-xxl-9 mb-xl-8 mb-lg-7 mb-4">
                <p className="pra-clr challenge-pra1">
                  Nam posuere mauris enim, quis pretium elit placerat id Fusce egestas nisi vel ipsum vehicula facilisis In pulvinar imperdiet venenatis Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Donec eu pulvinar lorem. Etiam vestibulum ligula quis nisl feugiat, consectetur placerat augue vestibulum Nulla aliquam elit eu diam pharetra.
                </p>
                <p className="pra-clr">
                  Fusce egestas nisi vel ipsum vehicula facilisis. In pulvinar imperdiet venenatis. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Donec eu pulvinar lorem. Etiam vestibulum ligula quis nisl feugiat, consectetur placerat augue vestibulum.
                </p>
              </div>
              <div className="finul-result">
                <h4 className="mb-xxl-3 mb-2 white-clr">Benefits With Our Service</h4>
                <div className="d-md-flex flex-grid align-items-center gap-xxl-20 gap-xl-10 gap-lg-7 gap-md-6 gap-10">
                  <div className="fiial-result-list mb-md-0 mb-4">
                    <ul>
                      <li>consectetur placerat augue vestibulum</li>
                      <li>consectetur placerat augue vestibulum</li>
                      <li>consectetur placerat augue vestibulum</li>
                    </ul>
                    <ul>
                      <li>consectetur placerat augue vestibulum</li>
                      <li>consectetur placerat augue vestibulum</li>
                      <li>consectetur placerat augue vestibulum</li>
                    </ul>
                  </div>
                  <div className="result-progress-wrap">
                    <div className="progres-item mb-xxl-6 mb-xl-5 mb-4">
                      <div className="d-flex align-items-center justify-content-between mb-xxl-5 mb-3">
                        <span className="conssub">Branding Design</span>
                        {" "}
                        <span className="cons">88%</span>
                      </div>
                      <div className="progress-solving">
                        <div className="progress-bar" />
                      </div>
                    </div>
                    <div className="progres-item">
                      <div className="d-flex align-items-center justify-content-between mb-xxl-5 mb-3">
                        <span className="conssub">Business</span>
                        {" "}
                        <span className="cons">96%</span>
                      </div>
                      <div className="progress-solving">
                        <div className="progress-bar" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="swiper study-slidewrap py-xxl-15 py-xl-10 py-9">
              <div className="swiper-wrapper">
                <div className="swiper-slide">
                  <div className="study-thumb-slide w-100">
                    <img src="/site/assets/img/service/service-slide1.png" alt="img" className="w-100" />
                  </div>
                </div>
                <div className="swiper-slide">
                  <div className="study-thumb-slide w-100">
                    <img src="/site/assets/img/service/service-slide2.png" alt="img" className="w-100" />
                  </div>
                </div>
                <div className="swiper-slide">
                  <div className="study-thumb-slide w-100">
                    <img src="/site/assets/img/service/service-slide1.png" alt="img" className="w-100" />
                  </div>
                </div>
              </div>
            </div>
            <div className="slider-button d-flex align-items-center justify-content-between py-xxl-6 py-xl-5 py-4">
              <div className="d-flex align-items-center gap-xxl-5 gap-3 gap-2">
                <button className="cmn-prev cmn-border d-center" tabIndex={0} aria-label="Next slide">
                  <SiteIcon name="chevron-left" />
                </button>
                {" "}
                <span className="fw-bold white-clr previus-text text-capitalize">previous</span>
              </div>
              <h3 className="project-storke">Services</h3>
              <div className="d-flex align-items-center gap-xxl-5 gap-3 gap-2">
                <span className="fw-bold white-clr previus-text text-capitalize">Next</span>
                {" "}
                <button className="cmn-next cmn-border d-center" tabIndex={0} aria-label="Previous slide">
                  <SiteIcon name="chevron-right" />
                </button>
              </div>
            </div>
          </div>
        </section>
        {/* Service Details End */}
      </main>
    </SitePage>
  );
}

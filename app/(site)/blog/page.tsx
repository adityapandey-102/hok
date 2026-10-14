import type { Metadata } from "next";
import { SitePage } from "@/modules/site/components/SitePage";
import { SiteIcon } from "@/modules/site/components/SiteIcon";

/** Ported as-is from the HOK template's `blog-grid.html` (see README "Portfolio"). */
export const metadata: Metadata = { title: "Blog" };

export default function BlogPage() {
  return (
    <SitePage variant="inner">
      <main className="main">
        {/* Breadcrumnd Banner */}
        <section className="breadcrumnd-banner position-relative">
          <div className="container">
            <div className="row g-5 justify-content-center">
              <div className="col-lg-5">
                <div className="breadcrumnd-content text-center">
                  <h1 className="white mb-xxl-10 mb-xl-8 mb-6" data-aos="zoom-in-left" data-aos-duration="1800">Blog Grid</h1>
                  <ul className="breadcrumnd d-inline-flex align-items-center gap-2 pra-border radius100 py-xxl-3 py-2 px-xxl-4 px-4" data-aos="zoom-in-right" data-aos-duration="2000">
                    <li>
                      <a href="/" className="text-uppercase htheme">Home</a>
                    </li>
                    <li>
                      <span className="rot60 d-inline-block">
                        <SiteIcon name="arrow-up" />
                      </span>
                    </li>
                    <li className="theme-clr">Blog Grid</li>
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
        {/* Blog Grid Start */}
        <section className="blog-grid pt-space pb-space">
          <div className="container">
            <div className="row g-xxl-7 g-xl-6 g-6">
              <div className="col-lg-4 col-md-6 col-sm-6">
                <div className="blog-widget-item">
                  <div className="thumb w-100 overflow-hidden mb-xxl-7 mb-xl-6 mb-4">
                    <img src="/site/assets/img/blog/mblog1.png" alt="img" className="w-100 overflow-hidden" />
                  </div>
                  <div className="blog-cont">
                    <div className="d-flex align-items-center gap-xxl-5 gap-xl-4 gap-3 mb-xxl-5 mb-xl-4 mb-3">
                      <a href="/blog/details" className="radius-btn cmn-border radius100 py-xxl-1 py-1 px-xxl-4 px-3 theme-clr">Creative</a>
                      {" "}
                      <span className="bspan-clr">MARCH 24, 2024</span>
                    </div>
                    <h5>
                      <a href="/blog/details" className="white-clr">Transforming Challenges into</a>
                    </h5>
                  </div>
                </div>
              </div>
              <div className="col-lg-4 col-md-6 col-sm-6">
                <div className="blog-widget-item">
                  <div className="thumb w-100 overflow-hidden mb-xxl-7 mb-xl-6 mb-4">
                    <img src="/site/assets/img/blog/mblog2.png" alt="img" className="w-100 overflow-hidden" />
                  </div>
                  <div className="blog-cont">
                    <div className="d-flex align-items-center gap-xxl-5 gap-xl-4 gap-3 mb-xxl-5 mb-xl-4 mb-3">
                      <a href="/blog/details" className="radius-btn cmn-border radius100 py-xxl-1 py-1 px-xxl-4 px-3 theme-clr">Creative</a>
                      {" "}
                      <span className="bspan-clr">MARCH 24, 2024</span>
                    </div>
                    <h5>
                      <a href="/blog/details" className="white-clr">Design Inspiration Where to Find</a>
                    </h5>
                  </div>
                </div>
              </div>
              <div className="col-lg-4 col-md-6 col-sm-6">
                <div className="blog-widget-item">
                  <div className="thumb w-100 overflow-hidden mb-xxl-7 mb-xl-6 mb-4">
                    <img src="/site/assets/img/blog/mblog3.png" alt="img" className="w-100 overflow-hidden" />
                  </div>
                  <div className="blog-cont">
                    <div className="d-flex align-items-center gap-xxl-5 gap-xl-4 gap-3 mb-xxl-5 mb-xl-4 mb-3">
                      <a href="/blog/details" className="radius-btn cmn-border radius100 py-xxl-1 py-1 px-xxl-4 px-3 theme-clr">Creative</a>
                      {" "}
                      <span className="bspan-clr">MARCH 24, 2024</span>
                    </div>
                    <h5>
                      <a href="/blog/details" className="white-clr">Creating new working in the digital</a>
                    </h5>
                  </div>
                </div>
              </div>
              <div className="col-lg-4 col-md-6 col-sm-6">
                <div className="blog-widget-item">
                  <div className="thumb w-100 overflow-hidden mb-xxl-7 mb-xl-6 mb-4">
                    <img src="/site/assets/img/blog/mblog4.png" alt="img" className="w-100 overflow-hidden" />
                  </div>
                  <div className="blog-cont">
                    <div className="d-flex align-items-center gap-xxl-5 gap-xl-4 gap-3 mb-xxl-5 mb-xl-4 mb-3">
                      <a href="/blog/details" className="radius-btn cmn-border radius100 py-xxl-1 py-1 px-xxl-4 px-3 theme-clr">Creative</a>
                      {" "}
                      <span className="bspan-clr">MARCH 24, 2024</span>
                    </div>
                    <h5>
                      <a href="/blog/details" className="white-clr">Business meeting San Francisco</a>
                    </h5>
                  </div>
                </div>
              </div>
              <div className="col-lg-4 col-md-6 col-sm-6">
                <div className="blog-widget-item">
                  <div className="thumb w-100 overflow-hidden mb-xxl-7 mb-xl-6 mb-4">
                    <img src="/site/assets/img/blog/mblog5.png" alt="img" className="w-100 overflow-hidden" />
                  </div>
                  <div className="blog-cont">
                    <div className="d-flex align-items-center gap-xxl-5 gap-xl-4 gap-3 mb-xxl-5 mb-xl-4 mb-3">
                      <a href="/blog/details" className="radius-btn cmn-border radius100 py-xxl-1 py-1 px-xxl-4 px-3 theme-clr">Creative</a>
                      {" "}
                      <span className="bspan-clr">MARCH 24, 2024</span>
                    </div>
                    <h5>
                      <a href="/blog/details" className="white-clr">Free advertising for your online</a>
                    </h5>
                  </div>
                </div>
              </div>
              <div className="col-lg-4 col-md-6 col-sm-6">
                <div className="blog-widget-item">
                  <div className="thumb w-100 overflow-hidden mb-xxl-7 mb-xl-6 mb-4">
                    <img src="/site/assets/img/blog/mblog6.png" alt="img" className="w-100 overflow-hidden" />
                  </div>
                  <div className="blog-cont">
                    <div className="d-flex align-items-center gap-xxl-5 gap-xl-4 gap-3 mb-xxl-5 mb-xl-4 mb-3">
                      <a href="/blog/details" className="radius-btn cmn-border radius100 py-xxl-1 py-1 px-xxl-4 px-3 theme-clr">Creative</a>
                      {" "}
                      <span className="bspan-clr">MARCH 24, 2024</span>
                    </div>
                    <h5>
                      <a href="/blog/details" className="white-clr">Creating new working in the digital</a>
                    </h5>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Blog Grid End */}
      </main>
    </SitePage>
  );
}

import { SitePage } from "@/modules/site/components/SitePage";
import { ExpandableText } from "@/modules/site/components/ExpandableText";
import { SiteIcon } from "@/modules/site/components/SiteIcon";

/** Ported as-is from the HOK template's `index.html` (see README "Portfolio"). */
export default function HomePage() {
  return (
    <SitePage variant="home">
      <main className="main position-relative overflow-hidden" id="mains">
        {/* Custom Line Shape */}
        <div className="line-shape cus-z-1 first w-100 h-100 d-flex flex-wrap" />
        {/* Custom Line Shape */}
        {/* Hero Section Version0 */}
        <section className="hero-section-version1 position-relative">
          <div className="container">
            <div className="row g-5">
              <div className="hero-v1-content position-relative">
                <div className="d-flex align-items-sm-center align-items-end justify-content-between">
                  <h1 className="white-clr text-uppercase">
                    <span className="d-block" data-aos="zoom-in-left" data-aos-duration="1800">Next Generation</span>
                    {" "}
                    <span>
                      <span className="text-italic" data-aos="zoom-in-right" data-aos-duration="2100">Creative</span>
                      {" "}
                      <span className="designers" data-text="Agency" data-aos="zoom-in" data-aos-duration="2000">Agency</span>
                    </span>
                  </h1>
                </div>
              </div>
            </div>
          </div>
          {/* Hero Exprience box */}
          <div className="hero-expriencebox d-flex align-items-center">
            <div className="expri-thumb">
              <img src="/site/assets/img/banner/bn-expri.png" alt="img" />
            </div>
            <div className="expri-content d-flex align-items-center gap-xxl-11 gap-xl-9 gap-lg-7 gap-6">
              <div className="expri-cont-item">
                <h6 className="white-clr mb-2">12+</h6>
                <span className="yer spantext-clr">years of experience</span>
              </div>
              <div className="expri-cont-item">
                <h6 className="white-clr mb-2">25K+</h6>
                <span className="yer spantext-clr">completed projects</span>
              </div>
            </div>
          </div>
          {/* Element */}
          <img src="/site/assets/img/element/arrow-right-storke.png" alt="img" className="hero-arrow" />
        </section>
        {/* Hero Section Version0 */}
        {/* Infinite Logo Carousel Start */}
        <section className="logo-carousel-section py-5">
          <div className="container">
            <div className="logo-carousel">
              <div className="logo-track">
                {/* First set of logos */}
                <div className="logo-item">
                  <img src="/site/assets/img/client/c1.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c2.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c3.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c1.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c2.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c3.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c1.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c2.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c3.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c1.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c2.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c3.png" alt="Brand Logo" />
                </div>
                {/* Duplicate set for seamless loop */}
                <div className="logo-item">
                  <img src="/site/assets/img/client/c1.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c2.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c3.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c1.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c2.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c3.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c1.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c2.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c3.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c1.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c2.png" alt="Brand Logo" />
                </div>
                <div className="logo-item">
                  <img src="/site/assets/img/client/c3.png" alt="Brand Logo" />
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Infinite Logo Carousel End */}
        {/* Product That Start */}
        <section className="about-product pt-space">
          <div className="container">
            <div className="row g-xxl-7 g-5">
              <div className="col-lg-6 col-md-6 col-sm-8">
                <div className="about-product-thumb w-100" data-aos="zoom-in" data-aos-duration="2000">
                  <img src="/site/assets/img/about/about-v1thumb.png" alt="img" className="w-100" />
                </div>
              </div>
              <div className="col-lg-6">
                <div className="about-product-content ps-xxl-10">
                  <div className="pricing-title">
                    <div className="radius-btn text-uppercase cmn-border d-inline-flex radius100 py-xxl-2 py-2 px-xxl-4 px-4 theme-clr gap-xxl-4 gap-3 mb-xxl-7 mb-xl-6 mb-5" data-aos="fade-up-right" data-aos-duration="1500">
                      Our Journey of Growth &amp; Innovation
                      {" "}
                      <span className="rot60 d-inline-block">
                        <SiteIcon name="arrow-up" className="theme-clr" />
                      </span>
                    </div>
                    <h2 className="stitle mb-xxl-8 mb-xl-7 mb-xl-5 mb-4" data-aos="fade-up" data-aos-duration="1600">
                      Professional &amp;
                      {" "}
                      <span className="fw-400 theme-clr">Credibility-Focused</span>
                    </h2>
                    <p className="white-clr mb-xxl-9 mb-xl-7 mb-xl-6 mb-6" data-aos="fade-up" data-aos-duration="1900">
                      Since 2016, we&apos;ve been helping brands transform their digital presence with creativity, technology, and measurable results. Each milestone marks a new step in our mission to deliver smarter marketing and lasting impact.
                    </p>
                    <div className="discover-dating" data-aos="fade-up" data-aos-duration="2200">
                      <div className="allyear d-flex align-items-center justify-content-between mb-xxl-4 mb-xl-3">
                        <h5 className="fw-medium theme-clr">2016</h5>
                        <h5 className="fw-medium theme-clr">2019</h5>
                        <h5 className="fw-medium theme-clr">2023</h5>
                      </div>
                      <div className="allyear-content d-flex justify-content-between">
                        <div className="allyear-item">
                          <h5 className="white-clr mb-xxl-3 mb-2">Our Beginning</h5>
                          <ExpandableText
                            preview="The vision takes shape - We launched as a small, ambitious team helping local businesses grow online..."
                            full="The vision takes shape - We launched as a small, ambitious team helping local businesses grow online—laying the foundation for our future in digital marketing innovation."
                          />
                        </div>
                        <div className="allyear-item">
                          <h5 className="white-clr mb-xxl-3 mb-2">Growth &amp; Expansion</h5>
                          <ExpandableText
                            preview="Scaling impact - By 2019, we had expanded nationwide, driving measurable results across industries..."
                            full="Scaling impact - By 2019, we had expanded nationwide, driving measurable results across industries. Clients trusted us to scale campaigns that consistently lowered acquisition costs and boosted ROI."
                          />
                        </div>
                        <div className="allyear-item">
                          <h5 className="white-clr mb-xxl-3 mb-2">Innovation Era</h5>
                          <ExpandableText
                            preview="Powered by technology - With AI-driven analytics and automation, we now help brands achieve faster..."
                            full="Powered by technology - With AI-driven analytics and automation, we now help brands achieve faster, smarter, and more sustainable growth— delivering results that stand out in today's digital-first world."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Product That End */}
        {/* Service Version01 Tabs Start */}
        <section className="service-section pt-space pb-space">
          <div className="container position-relative">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-5 mb-xxl-17 mb-xl-12 mb-lg-10 mb-md-10 mb-sm-10 mb-9">
              <div className="pricing-title">
                <div className="radius-btn text-uppercase cmn-border d-inline-flex radius100 py-xxl-2 py-2 px-xxl-4 px-4 theme-clr gap-xxl-4 gap-3 mb-xxl-8 mb-xl-6 mb-5">
                  WHAT WE OFFER
                  {" "}
                  <span className="rot60 d-inline-block">
                    <SiteIcon name="arrow-up" className="theme-clr" />
                  </span>
                </div>
                <h2 className="stitle">
                  Most
                  {" "}
                  <span className="fw-400">experienced</span>
                  {" "}
                  services
                </h2>
              </div>
              <a href="/services" className="radius-btn d-inline-flex radius100 py-xxl-2 py-2 px-xxl-5 px-5 theme-border theme-clr gap-xxl-4 gap-3 mb-xxl-8 mb-xl-6 mb-5">View All Service</a>
            </div>
            {/* Service Tabing section */}
            <div className="row g-xxl-6 g-4">
              <div className="service-tabing-wrap Faqs-section">
                <div className="accordion-single active py-xxl-9 py-xl-7 py-lg-6 py-5 bt-border">
                  <div className="header-area">
                    <div className="accordion-btn justify-content-between d-flex align-items-center text-start d-flex position-relative w-100">
                      <div className="mtitle-ara">
                        <span className="d-inine-flex serial-badge align-items-center gap-4 cmn-border radius100 white-clr">
                          01
                          {" "}
                          <span className="rot60 d-inline-block theme-clr">
                            <SiteIcon name="arrow-right" />
                          </span>
                        </span>
                        {" "}
                        <span className="mtitle d-block mt-6">
                          <a href="/services/details" className="white-clr whitehover">Digital Marketing &amp; Growth</a>
                        </span>
                        {" "}
                        <span className="pras mt-xxl-7 mt-xl-5 mt-4 d-block">
                          Driving measurable results through strategy, performance, and engagement.
                        </span>
                      </div>
                      <div className="images-remove-area d-lg-flex d-none align-items-center gap-xxl-8 gap-4">
                        <ul className="modern-list d-grid gap-2">
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Digital Marketing Campaigns
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Content Creation &amp; Strategy
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Digital Media Management &amp; Conversion
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Funnels &amp; Branding
                          </li>
                        </ul>
                        <div className="tab-remove-thumb">
                          <img src="/site/assets/img/service/tab1.png" alt="img" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="accordion-single py-xxl-9 py-xl-7 py-lg-6 py-5 bt-border">
                  <div className="header-area">
                    <div className="accordion-btn justify-content-between d-flex align-items-center text-start d-flex position-relative w-100">
                      <div className="mtitle-ara">
                        <span className="d-inine-flex serial-badge align-items-center gap-4 cmn-border radius100 white-clr">
                          02
                          {" "}
                          <span className="rot60 d-inline-block theme-clr">
                            <SiteIcon name="arrow-right" />
                          </span>
                        </span>
                        {" "}
                        <span className="mtitle d-block mt-6">
                          <a href="/services/details" className="white-clr whitehover">Web &amp; App Development</a>
                        </span>
                        {" "}
                        <span className="pras mt-xxl-7 mt-xl-5 mt-4 d-block">
                          Building responsive, dynamic, and high-performing digital platforms.
                        </span>
                      </div>
                      <div className="images-remove-area d-lg-flex d-none align-items-center gap-xxl-8 gap-4">
                        <ul className="modern-list d-grid gap-2">
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Website Development &amp; Landing Pages
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Mobile App &amp; Custom Software Development
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Ecommerce Stores
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Responsive, Dynamic &amp; Animated
                          </li>
                        </ul>
                        <div className="tab-remove-thumb">
                          <img src="/site/assets/img/service/tab2.png" alt="img" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="accordion-single py-xxl-9 py-xl-7 py-lg-6 py-5 bt-border">
                  <div className="header-area">
                    <div className="accordion-btn justify-content-between d-flex align-items-center text-start d-flex position-relative w-100">
                      <div className="mtitle-ara">
                        <span className="d-inine-flex serial-badge align-items-center gap-4 cmn-border radius100 white-clr">
                          03
                          {" "}
                          <span className="rot60 d-inline-block theme-clr">
                            <SiteIcon name="arrow-right" />
                          </span>
                        </span>
                        {" "}
                        <span className="mtitle d-block mt-6">
                          <a href="/services/details" className="white-clr whitehover">Startup Acceleration &amp; Consulting</a>
                        </span>
                        {" "}
                        <span className="pras mt-xxl-7 mt-xl-5 mt-4 d-block">
                          Helping founders scale smarter, raise capital, and launch stronger.
                        </span>
                      </div>
                      <div className="images-remove-area d-lg-flex d-none align-items-center gap-xxl-8 gap-4">
                        <ul className="modern-list d-grid gap-2">
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Startup Acceleration Services
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Startup &amp; Fundraising Consultation
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Business Setup Services
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Strategic Planning &amp; Growth
                          </li>
                        </ul>
                        <div className="tab-remove-thumb">
                          <img src="/site/assets/img/service/tab3.png" alt="img" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="accordion-single py-xxl-9 py-xl-7 py-lg-6 py-5 bb-border bt-border">
                  <div className="header-area">
                    <div className="accordion-btn justify-content-between d-flex align-items-center text-start d-flex position-relative w-100">
                      <div className="mtitle-ara">
                        <span className="d-inine-flex serial-badge align-items-center gap-4 cmn-border radius100 white-clr">
                          04
                          {" "}
                          <span className="rot60 d-inline-block theme-clr">
                            <SiteIcon name="arrow-right" />
                          </span>
                        </span>
                        {" "}
                        <span className="mtitle d-block mt-6">
                          <a href="/services/details" className="white-clr whitehover">Creative &amp; Visual Design</a>
                        </span>
                        {" "}
                        <span className="pras mt-xxl-7 mt-xl-5 mt-4 d-block">
                          Crafting compelling visuals and immersive experiences that bring ideas to life.
                        </span>
                      </div>
                      <div className="images-remove-area d-lg-flex d-none align-items-center gap-xxl-8 gap-4">
                        <ul className="modern-list d-grid gap-2">
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Motion Graphics
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Graphics Production
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            CGI and 3D Designs
                          </li>
                          <li className="d-flex align-items-center gap-2">
                            <SiteIcon name="chevron-right" />
                            {" "}
                            Custom Visual Content
                          </li>
                        </ul>
                        <div className="tab-remove-thumb">
                          <img src="/site/assets/img/service/tab4.png" alt="img" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Service Tabing section */}
          </div>
        </section>
        {/* Service Version01 Tabs End */}
        {/* Text SLider Start */}
        <div className="digital-solution testi-italic pb-lg-20 pb-15">
          <div className="mycustom-marque">
            <div className="scrolling-wrap">
              <div className="comm">
                <div className="cmn-textslide textitalick">Creative &amp; Visual Design</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Motion Graphics</div>
                <div className="cmn-textslide textitalick">Graphics Production</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">CGI and 3D Designs</div>
                <div className="cmn-textslide textitalick">Custom Visual Content</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Web &amp; App Development</div>
                <div className="cmn-textslide textitalick">Website Development &amp; Landing Pages</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Mobile App &amp; Custom Software Development</div>
                <div className="cmn-textslide textitalick">Ecommerce Stores</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Digital Marketing &amp; Growth</div>
                <div className="cmn-textslide textitalick">Digital Marketing</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Content Creation &amp; Strategy</div>
                <div className="cmn-textslide textitalick">Digital Media Management &amp; Conversion Funnels</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Branding</div>
              </div>
              <div className="comm">
                <div className="cmn-textslide textitalick">Creative &amp; Visual Design</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Motion Graphics</div>
                <div className="cmn-textslide textitalick">Graphics Production</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">CGI and 3D Designs</div>
                <div className="cmn-textslide textitalick">Custom Visual Content</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Web &amp; App Development</div>
                <div className="cmn-textslide textitalick">Website Development &amp; Landing Pages</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Mobile App &amp; Custom Software Development</div>
                <div className="cmn-textslide textitalick">Ecommerce Stores</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Digital Marketing &amp; Growth</div>
                <div className="cmn-textslide textitalick">Digital Marketing</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Content Creation &amp; Strategy</div>
                <div className="cmn-textslide textitalick">Digital Media Management &amp; Conversion Funnels</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Branding</div>
              </div>
            </div>
          </div>
        </div>
        {/* Text Slider End */}
        {/* Case Studyv01 Start */}
        <section className="case-study-vsesion01 bg2-clr pb-space">
          <div className="container">
            <div className="row g-xxl-7 g-xl-5 g-4">
              <div className="col-lg-6 col-md-6" data-aos="zoom-in-left" data-aos-duration="1400">
                <div className="blog-widget-item bb-border pb-xxl-7 pb-xl-6 pb-4">
                  <div className="thumb w-100 overflow-hidden mb-xxl-7 mb-xl-6 mb-4">
                    <img src="/site/assets/img/case/study-grid1.png" alt="img" className="w-100 overflow-hidden" />
                  </div>
                  <div className="blog-cont">
                    <div className="d-flex align-items-center gap-xxl-5 gap-xl-4 gap-3 mb-xxl-5 mb-xl-4 mb-3">
                      <a href="/case-studies/details" className="radius-btn cmn-border radius100 py-xxl-2 py-2 px-xxl-4 px-3 theme-clr">Creative</a>
                    </div>
                    <h5>
                      <a href="/case-studies/details" className="white-clr d-flex align-items-center justify-content-between gap-3">
                        A Simple Social Media Marketing Checklist
                        {" "}
                        <span className="rot60">
                          <SiteIcon name="arrow-up" className="theme-clr" />
                        </span>
                      </a>
                    </h5>
                  </div>
                </div>
              </div>
              <div className="col-lg-6 col-md-6" data-aos="zoom-in-left" data-aos-duration="1600">
                <div className="blog-widget-item bb-border pb-xxl-7 pb-xl-6 pb-4">
                  <div className="thumb w-100 overflow-hidden mb-xxl-7 mb-xl-6 mb-4">
                    <img src="/site/assets/img/case/study-grid2.png" alt="img" className="w-100 overflow-hidden" />
                  </div>
                  <div className="blog-cont">
                    <div className="d-flex align-items-center gap-xxl-5 gap-xl-4 gap-3 mb-xxl-5 mb-xl-4 mb-3">
                      <a href="/case-studies/details" className="radius-btn cmn-border radius100 py-xxl-2 py-2 px-xxl-4 px-3 theme-clr">Branding</a>
                    </div>
                    <h5>
                      <a href="/case-studies/details" className="white-clr d-flex align-items-center justify-content-between gap-3">
                        Transforming Challenges into Opportunities
                        {" "}
                        <span className="rot60">
                          <SiteIcon name="arrow-up" className="theme-clr" />
                        </span>
                      </a>
                    </h5>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Case Studyv01 End */}
        {/* Watch Version01 Start */}
        <div className="watch-version01 zindex1 position-relative">
          <div className="container">
            <div className="watch-content d-center">
              <a href="https://cdn.shopify.com/videos/c/o/v/584dd57848d74f6d89e72c941a2a13a4.mov" className="video-popup position-relative">
                <span className="icons themebg radius100 d-center">
                  <SiteIcon name="play" solid />
                </span>
                {" "}
                <img src="/site/assets/img/element/watch-ciricle01.png" alt="img" className="circle" />
              </a>
            </div>
          </div>
        </div>
        {/* Watch Version01 End */}
        {/* Cmn Team version01 Start */}
        <section className="team-version01 pt-space pb-space">
          <div className="container position-relative">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-5 mb-xxl-15 mb-xl-12 mb-lg-10 mb-md-10 mb-sm-10 mb-9">
              <div className="pricing-title">
                <div className="radius-btn text-uppercase cmn-border d-inline-flex radius100 py-xxl-2 py-2 px-xxl-4 px-4 theme-clr gap-xxl-4 gap-3 mb-xxl-8 mb-xl-6 mb-5">
                  oUR experts
                  {" "}
                  <span className="rot60 d-inline-block">
                    <SiteIcon name="arrow-up" className="theme-clr" />
                  </span>
                </div>
                <h2 className="stitle">
                  Meet our
                  {" "}
                  <span className="fw-400">creative</span>
                  {" "}
                  staff
                </h2>
              </div>
              <a href="/team" className="radius-btn d-inline-flex text-capitalize radius100 py-xxl-2 py-2 px-xxl-5 px-5 theme-border theme-clr gap-xxl-4 gap-3 mb-xxl-8 mb-xl-6 mb-5">view all teams</a>
            </div>
            <div className="row g-xxl-7 g-xl-5 g-4 justify-content-center">
              <div className="col-xl-3 col-lg-4 col-md-6 col-sm-6" data-aos="fadein" data-aos-duration="1400">
                <div className="team-card01 tilt overflow-hidden">
                  <div className="thumb overflow-hidden w-100 position-relative mb-xxl-7 mb-xl-6 mb-5">
                    <img src="/site/assets/img/team/team2.png" alt="img" className="w-100" />
                    <ul className="common-social d-flex align-items-center justify-content-center gap-xxl-3 gap-xl-2 gap-1">
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="11" height="20" viewBox="0 0 11 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.0391 11.25L10.5859 7.65625H7.10938V5.3125C7.10938 4.29688 7.57812 3.35938 9.14062 3.35938H10.7422V0.273438C10.7422 0.273438 9.29688 0 7.92969 0C5.07812 0 3.20312 1.75781 3.20312 4.88281V7.65625H0V11.25H3.20312V20H7.10938V11.25H10.0391Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="21" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.7645 4.84375C7.90737 4.84375 5.63058 7.16518 5.63058 9.97768C5.63058 12.8348 7.90737 15.1116 10.7645 15.1116C13.577 15.1116 15.8984 12.8348 15.8984 9.97768C15.8984 7.16518 13.577 4.84375 10.7645 4.84375ZM10.7645 13.3259C8.93415 13.3259 7.41629 11.8527 7.41629 9.97768C7.41629 8.14732 8.88951 6.67411 10.7645 6.67411C12.5949 6.67411 14.0681 8.14732 14.0681 9.97768C14.0681 11.8527 12.5949 13.3259 10.7645 13.3259ZM17.2824 4.66518C17.2824 3.99554 16.7467 3.45982 16.077 3.45982C15.4074 3.45982 14.8717 3.99554 14.8717 4.66518C14.8717 5.33482 15.4074 5.87054 16.077 5.87054C16.7467 5.87054 17.2824 5.33482 17.2824 4.66518ZM20.6752 5.87054C20.5859 4.26339 20.2288 2.83482 19.0681 1.67411C17.9074 0.513393 16.4788 0.15625 14.8717 0.0669643C13.2199 -0.0223214 8.26451 -0.0223214 6.61272 0.0669643C5.00558 0.15625 3.62165 0.513393 2.41629 1.67411C1.25558 2.83482 0.898438 4.26339 0.809152 5.87054C0.719866 7.52232 0.719866 12.4777 0.809152 14.1295C0.898438 15.7366 1.25558 17.1205 2.41629 18.3259C3.62165 19.4866 5.00558 19.8438 6.61272 19.933C8.26451 20.0223 13.2199 20.0223 14.8717 19.933C16.4788 19.8438 17.9074 19.4866 19.0681 18.3259C20.2288 17.1205 20.5859 15.7366 20.6752 14.1295C20.7645 12.4777 20.7645 7.52232 20.6752 5.87054ZM18.5324 15.8705C18.2199 16.7634 17.5056 17.433 16.6574 17.7902C15.3181 18.3259 12.1931 18.192 10.7645 18.192C9.2913 18.192 6.16629 18.3259 4.87165 17.7902C3.97879 17.433 3.30915 16.7634 2.95201 15.8705C2.41629 14.5759 2.55022 11.4509 2.55022 9.97768C2.55022 8.54911 2.41629 5.42411 2.95201 4.08482C3.30915 3.23661 3.97879 2.56696 4.87165 2.20982C6.16629 1.67411 9.2913 1.80804 10.7645 1.80804C12.1931 1.80804 15.3181 1.67411 16.6574 2.20982C17.5056 2.52232 18.1752 3.23661 18.5324 4.08482C19.0681 5.42411 18.9342 8.54911 18.9342 9.97768C18.9342 11.4509 19.0681 14.5759 18.5324 15.8705Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="26" height="20" viewBox="0 0 26 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.8627 4.96386C23.8265 4.24096 24.694 3.37349 25.3687 2.36145C24.5012 2.74699 23.4892 3.03614 22.4771 3.13253C23.5374 2.50602 24.3085 1.54217 24.694 0.337349C23.7301 0.915663 22.6217 1.3494 21.5133 1.59036C20.5494 0.578313 19.2482 0 17.8024 0C15.0072 0 12.7422 2.26506 12.7422 5.06024C12.7422 5.44578 12.7904 5.83133 12.8868 6.21687C8.69399 5.9759 4.93496 3.95181 2.42893 0.915663C1.9952 1.63855 1.75424 2.50602 1.75424 3.46988C1.75424 5.20482 2.62171 6.74699 4.0193 7.66265C3.20002 7.61446 2.38074 7.42169 1.70604 7.03614V7.08434C1.70604 9.54217 3.44098 11.5663 5.75424 12.0482C5.36869 12.1446 4.88677 12.241 4.45303 12.241C4.11568 12.241 3.82652 12.1928 3.48918 12.1446C4.11568 14.1687 5.9952 15.6145 8.21207 15.6627C6.47713 17.012 4.30845 17.8313 1.94701 17.8313C1.51327 17.8313 1.12773 17.7831 0.742188 17.7349C2.95906 19.1807 5.60966 20 8.50122 20C17.8024 20 22.8627 12.3373 22.8627 5.63855C22.8627 5.39759 22.8627 5.20482 22.8627 4.96386Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.54036 0C4.41469 0 0.369141 2.72374 0.369141 7.16984C0.369141 9.97369 1.93128 11.5759 2.8926 11.5759C3.29315 11.5759 3.53348 10.4944 3.53348 10.174C3.53348 9.81347 2.57216 9.01237 2.57216 7.45023C2.57216 4.24583 5.01552 1.96269 8.17986 1.96269C10.9437 1.96269 12.9464 3.52484 12.9464 6.36874C12.9464 8.49166 12.1052 12.4571 9.34146 12.4571C8.34008 12.4571 7.45887 11.7361 7.45887 10.7347C7.45887 9.21264 8.54036 7.73061 8.54036 6.16847C8.54036 3.52484 4.77519 4.0055 4.77519 7.2099C4.77519 7.89083 4.8553 8.61182 5.17574 9.2527C4.61497 11.6159 3.49343 15.1808 3.49343 17.6242C3.49343 18.3852 3.57354 19.1062 3.65365 19.8673C3.77381 20.0275 3.73376 20.0275 3.93403 19.9474C5.93678 17.1836 5.89673 16.6228 6.77794 13.0179C7.29865 13.9391 8.54036 14.4598 9.58179 14.4598C13.8276 14.4598 15.7503 10.2941 15.7503 6.56902C15.7503 2.60357 12.3055 0 8.54036 0Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                    </ul>
                  </div>
                  <div className="content">
                    <span className="bspan-clr position-relative mb-xxl-4 mb-xxl-3 mb-3">Programmer</span>
                    <h5 className="white-clr whitehover">
                      <a href="/team/details" className="white-clr whitehover">Leslie Alexander</a>
                    </h5>
                  </div>
                </div>
              </div>
              <div className="col-xl-3 col-lg-4 col-md-6 col-sm-6 mt-lg-18" data-aos="fadein" data-aos-duration="1400">
                <div className="team-card01 tilt overflow-hidden">
                  <div className="thumb overflow-hidden w-100 position-relative mb-xxl-7 mb-xl-6 mb-5">
                    <img src="/site/assets/img/team/team3.png" alt="img" className="w-100" />
                    <ul className="common-social d-flex align-items-center justify-content-center gap-xxl-3 gap-xl-2 gap-1">
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="11" height="20" viewBox="0 0 11 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.0391 11.25L10.5859 7.65625H7.10938V5.3125C7.10938 4.29688 7.57812 3.35938 9.14062 3.35938H10.7422V0.273438C10.7422 0.273438 9.29688 0 7.92969 0C5.07812 0 3.20312 1.75781 3.20312 4.88281V7.65625H0V11.25H3.20312V20H7.10938V11.25H10.0391Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="21" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.7645 4.84375C7.90737 4.84375 5.63058 7.16518 5.63058 9.97768C5.63058 12.8348 7.90737 15.1116 10.7645 15.1116C13.577 15.1116 15.8984 12.8348 15.8984 9.97768C15.8984 7.16518 13.577 4.84375 10.7645 4.84375ZM10.7645 13.3259C8.93415 13.3259 7.41629 11.8527 7.41629 9.97768C7.41629 8.14732 8.88951 6.67411 10.7645 6.67411C12.5949 6.67411 14.0681 8.14732 14.0681 9.97768C14.0681 11.8527 12.5949 13.3259 10.7645 13.3259ZM17.2824 4.66518C17.2824 3.99554 16.7467 3.45982 16.077 3.45982C15.4074 3.45982 14.8717 3.99554 14.8717 4.66518C14.8717 5.33482 15.4074 5.87054 16.077 5.87054C16.7467 5.87054 17.2824 5.33482 17.2824 4.66518ZM20.6752 5.87054C20.5859 4.26339 20.2288 2.83482 19.0681 1.67411C17.9074 0.513393 16.4788 0.15625 14.8717 0.0669643C13.2199 -0.0223214 8.26451 -0.0223214 6.61272 0.0669643C5.00558 0.15625 3.62165 0.513393 2.41629 1.67411C1.25558 2.83482 0.898438 4.26339 0.809152 5.87054C0.719866 7.52232 0.719866 12.4777 0.809152 14.1295C0.898438 15.7366 1.25558 17.1205 2.41629 18.3259C3.62165 19.4866 5.00558 19.8438 6.61272 19.933C8.26451 20.0223 13.2199 20.0223 14.8717 19.933C16.4788 19.8438 17.9074 19.4866 19.0681 18.3259C20.2288 17.1205 20.5859 15.7366 20.6752 14.1295C20.7645 12.4777 20.7645 7.52232 20.6752 5.87054ZM18.5324 15.8705C18.2199 16.7634 17.5056 17.433 16.6574 17.7902C15.3181 18.3259 12.1931 18.192 10.7645 18.192C9.2913 18.192 6.16629 18.3259 4.87165 17.7902C3.97879 17.433 3.30915 16.7634 2.95201 15.8705C2.41629 14.5759 2.55022 11.4509 2.55022 9.97768C2.55022 8.54911 2.41629 5.42411 2.95201 4.08482C3.30915 3.23661 3.97879 2.56696 4.87165 2.20982C6.16629 1.67411 9.2913 1.80804 10.7645 1.80804C12.1931 1.80804 15.3181 1.67411 16.6574 2.20982C17.5056 2.52232 18.1752 3.23661 18.5324 4.08482C19.0681 5.42411 18.9342 8.54911 18.9342 9.97768C18.9342 11.4509 19.0681 14.5759 18.5324 15.8705Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="26" height="20" viewBox="0 0 26 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.8627 4.96386C23.8265 4.24096 24.694 3.37349 25.3687 2.36145C24.5012 2.74699 23.4892 3.03614 22.4771 3.13253C23.5374 2.50602 24.3085 1.54217 24.694 0.337349C23.7301 0.915663 22.6217 1.3494 21.5133 1.59036C20.5494 0.578313 19.2482 0 17.8024 0C15.0072 0 12.7422 2.26506 12.7422 5.06024C12.7422 5.44578 12.7904 5.83133 12.8868 6.21687C8.69399 5.9759 4.93496 3.95181 2.42893 0.915663C1.9952 1.63855 1.75424 2.50602 1.75424 3.46988C1.75424 5.20482 2.62171 6.74699 4.0193 7.66265C3.20002 7.61446 2.38074 7.42169 1.70604 7.03614V7.08434C1.70604 9.54217 3.44098 11.5663 5.75424 12.0482C5.36869 12.1446 4.88677 12.241 4.45303 12.241C4.11568 12.241 3.82652 12.1928 3.48918 12.1446C4.11568 14.1687 5.9952 15.6145 8.21207 15.6627C6.47713 17.012 4.30845 17.8313 1.94701 17.8313C1.51327 17.8313 1.12773 17.7831 0.742188 17.7349C2.95906 19.1807 5.60966 20 8.50122 20C17.8024 20 22.8627 12.3373 22.8627 5.63855C22.8627 5.39759 22.8627 5.20482 22.8627 4.96386Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.54036 0C4.41469 0 0.369141 2.72374 0.369141 7.16984C0.369141 9.97369 1.93128 11.5759 2.8926 11.5759C3.29315 11.5759 3.53348 10.4944 3.53348 10.174C3.53348 9.81347 2.57216 9.01237 2.57216 7.45023C2.57216 4.24583 5.01552 1.96269 8.17986 1.96269C10.9437 1.96269 12.9464 3.52484 12.9464 6.36874C12.9464 8.49166 12.1052 12.4571 9.34146 12.4571C8.34008 12.4571 7.45887 11.7361 7.45887 10.7347C7.45887 9.21264 8.54036 7.73061 8.54036 6.16847C8.54036 3.52484 4.77519 4.0055 4.77519 7.2099C4.77519 7.89083 4.8553 8.61182 5.17574 9.2527C4.61497 11.6159 3.49343 15.1808 3.49343 17.6242C3.49343 18.3852 3.57354 19.1062 3.65365 19.8673C3.77381 20.0275 3.73376 20.0275 3.93403 19.9474C5.93678 17.1836 5.89673 16.6228 6.77794 13.0179C7.29865 13.9391 8.54036 14.4598 9.58179 14.4598C13.8276 14.4598 15.7503 10.2941 15.7503 6.56902C15.7503 2.60357 12.3055 0 8.54036 0Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                    </ul>
                  </div>
                  <div className="content">
                    <span className="bspan-clr position-relative mb-xxl-4 mb-xxl-3 mb-3">UI/UX designer</span>
                    <h5 className="white-clr">
                      <a href="/team/details" className="white-clr whitehover">Darlene Robertson</a>
                    </h5>
                  </div>
                </div>
              </div>
              <div className="col-xl-3 col-lg-4 col-md-6 col-sm-6" data-aos="fadein" data-aos-duration="1400">
                <div className="team-card01 tilt overflow-hidden">
                  <div className="thumb overflow-hidden w-100 position-relative mb-xxl-7 mb-xl-6 mb-5">
                    <img src="/site/assets/img/team/team4.png" alt="img" className="w-100" />
                    <ul className="common-social d-flex align-items-center justify-content-center gap-xxl-3 gap-xl-2 gap-1">
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="11" height="20" viewBox="0 0 11 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.0391 11.25L10.5859 7.65625H7.10938V5.3125C7.10938 4.29688 7.57812 3.35938 9.14062 3.35938H10.7422V0.273438C10.7422 0.273438 9.29688 0 7.92969 0C5.07812 0 3.20312 1.75781 3.20312 4.88281V7.65625H0V11.25H3.20312V20H7.10938V11.25H10.0391Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="21" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.7645 4.84375C7.90737 4.84375 5.63058 7.16518 5.63058 9.97768C5.63058 12.8348 7.90737 15.1116 10.7645 15.1116C13.577 15.1116 15.8984 12.8348 15.8984 9.97768C15.8984 7.16518 13.577 4.84375 10.7645 4.84375ZM10.7645 13.3259C8.93415 13.3259 7.41629 11.8527 7.41629 9.97768C7.41629 8.14732 8.88951 6.67411 10.7645 6.67411C12.5949 6.67411 14.0681 8.14732 14.0681 9.97768C14.0681 11.8527 12.5949 13.3259 10.7645 13.3259ZM17.2824 4.66518C17.2824 3.99554 16.7467 3.45982 16.077 3.45982C15.4074 3.45982 14.8717 3.99554 14.8717 4.66518C14.8717 5.33482 15.4074 5.87054 16.077 5.87054C16.7467 5.87054 17.2824 5.33482 17.2824 4.66518ZM20.6752 5.87054C20.5859 4.26339 20.2288 2.83482 19.0681 1.67411C17.9074 0.513393 16.4788 0.15625 14.8717 0.0669643C13.2199 -0.0223214 8.26451 -0.0223214 6.61272 0.0669643C5.00558 0.15625 3.62165 0.513393 2.41629 1.67411C1.25558 2.83482 0.898438 4.26339 0.809152 5.87054C0.719866 7.52232 0.719866 12.4777 0.809152 14.1295C0.898438 15.7366 1.25558 17.1205 2.41629 18.3259C3.62165 19.4866 5.00558 19.8438 6.61272 19.933C8.26451 20.0223 13.2199 20.0223 14.8717 19.933C16.4788 19.8438 17.9074 19.4866 19.0681 18.3259C20.2288 17.1205 20.5859 15.7366 20.6752 14.1295C20.7645 12.4777 20.7645 7.52232 20.6752 5.87054ZM18.5324 15.8705C18.2199 16.7634 17.5056 17.433 16.6574 17.7902C15.3181 18.3259 12.1931 18.192 10.7645 18.192C9.2913 18.192 6.16629 18.3259 4.87165 17.7902C3.97879 17.433 3.30915 16.7634 2.95201 15.8705C2.41629 14.5759 2.55022 11.4509 2.55022 9.97768C2.55022 8.54911 2.41629 5.42411 2.95201 4.08482C3.30915 3.23661 3.97879 2.56696 4.87165 2.20982C6.16629 1.67411 9.2913 1.80804 10.7645 1.80804C12.1931 1.80804 15.3181 1.67411 16.6574 2.20982C17.5056 2.52232 18.1752 3.23661 18.5324 4.08482C19.0681 5.42411 18.9342 8.54911 18.9342 9.97768C18.9342 11.4509 19.0681 14.5759 18.5324 15.8705Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="26" height="20" viewBox="0 0 26 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.8627 4.96386C23.8265 4.24096 24.694 3.37349 25.3687 2.36145C24.5012 2.74699 23.4892 3.03614 22.4771 3.13253C23.5374 2.50602 24.3085 1.54217 24.694 0.337349C23.7301 0.915663 22.6217 1.3494 21.5133 1.59036C20.5494 0.578313 19.2482 0 17.8024 0C15.0072 0 12.7422 2.26506 12.7422 5.06024C12.7422 5.44578 12.7904 5.83133 12.8868 6.21687C8.69399 5.9759 4.93496 3.95181 2.42893 0.915663C1.9952 1.63855 1.75424 2.50602 1.75424 3.46988C1.75424 5.20482 2.62171 6.74699 4.0193 7.66265C3.20002 7.61446 2.38074 7.42169 1.70604 7.03614V7.08434C1.70604 9.54217 3.44098 11.5663 5.75424 12.0482C5.36869 12.1446 4.88677 12.241 4.45303 12.241C4.11568 12.241 3.82652 12.1928 3.48918 12.1446C4.11568 14.1687 5.9952 15.6145 8.21207 15.6627C6.47713 17.012 4.30845 17.8313 1.94701 17.8313C1.51327 17.8313 1.12773 17.7831 0.742188 17.7349C2.95906 19.1807 5.60966 20 8.50122 20C17.8024 20 22.8627 12.3373 22.8627 5.63855C22.8627 5.39759 22.8627 5.20482 22.8627 4.96386Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.54036 0C4.41469 0 0.369141 2.72374 0.369141 7.16984C0.369141 9.97369 1.93128 11.5759 2.8926 11.5759C3.29315 11.5759 3.53348 10.4944 3.53348 10.174C3.53348 9.81347 2.57216 9.01237 2.57216 7.45023C2.57216 4.24583 5.01552 1.96269 8.17986 1.96269C10.9437 1.96269 12.9464 3.52484 12.9464 6.36874C12.9464 8.49166 12.1052 12.4571 9.34146 12.4571C8.34008 12.4571 7.45887 11.7361 7.45887 10.7347C7.45887 9.21264 8.54036 7.73061 8.54036 6.16847C8.54036 3.52484 4.77519 4.0055 4.77519 7.2099C4.77519 7.89083 4.8553 8.61182 5.17574 9.2527C4.61497 11.6159 3.49343 15.1808 3.49343 17.6242C3.49343 18.3852 3.57354 19.1062 3.65365 19.8673C3.77381 20.0275 3.73376 20.0275 3.93403 19.9474C5.93678 17.1836 5.89673 16.6228 6.77794 13.0179C7.29865 13.9391 8.54036 14.4598 9.58179 14.4598C13.8276 14.4598 15.7503 10.2941 15.7503 6.56902C15.7503 2.60357 12.3055 0 8.54036 0Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                    </ul>
                  </div>
                  <div className="content">
                    <span className="bspan-clr position-relative mb-xxl-4 mb-xxl-3 mb-3">Web developer</span>
                    <h5 className="white-clr">
                      <a href="/team/details" className="white-clr whitehover">Marvin McKinney</a>
                    </h5>
                  </div>
                </div>
              </div>
              <div className="col-xl-3 col-lg-4 col-md-6 col-sm-6 mt-lg-18" data-aos="fadein" data-aos-duration="1400">
                <div className="team-card01 tilt overflow-hidden">
                  <div className="thumb overflow-hidden w-100 position-relative mb-xxl-7 mb-xl-6 mb-5">
                    <img src="/site/assets/img/team/team1.png" alt="img" className="w-100" />
                    <ul className="common-social d-flex align-items-center justify-content-center gap-xxl-3 gap-xl-2 gap-1">
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="11" height="20" viewBox="0 0 11 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.0391 11.25L10.5859 7.65625H7.10938V5.3125C7.10938 4.29688 7.57812 3.35938 9.14062 3.35938H10.7422V0.273438C10.7422 0.273438 9.29688 0 7.92969 0C5.07812 0 3.20312 1.75781 3.20312 4.88281V7.65625H0V11.25H3.20312V20H7.10938V11.25H10.0391Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="21" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.7645 4.84375C7.90737 4.84375 5.63058 7.16518 5.63058 9.97768C5.63058 12.8348 7.90737 15.1116 10.7645 15.1116C13.577 15.1116 15.8984 12.8348 15.8984 9.97768C15.8984 7.16518 13.577 4.84375 10.7645 4.84375ZM10.7645 13.3259C8.93415 13.3259 7.41629 11.8527 7.41629 9.97768C7.41629 8.14732 8.88951 6.67411 10.7645 6.67411C12.5949 6.67411 14.0681 8.14732 14.0681 9.97768C14.0681 11.8527 12.5949 13.3259 10.7645 13.3259ZM17.2824 4.66518C17.2824 3.99554 16.7467 3.45982 16.077 3.45982C15.4074 3.45982 14.8717 3.99554 14.8717 4.66518C14.8717 5.33482 15.4074 5.87054 16.077 5.87054C16.7467 5.87054 17.2824 5.33482 17.2824 4.66518ZM20.6752 5.87054C20.5859 4.26339 20.2288 2.83482 19.0681 1.67411C17.9074 0.513393 16.4788 0.15625 14.8717 0.0669643C13.2199 -0.0223214 8.26451 -0.0223214 6.61272 0.0669643C5.00558 0.15625 3.62165 0.513393 2.41629 1.67411C1.25558 2.83482 0.898438 4.26339 0.809152 5.87054C0.719866 7.52232 0.719866 12.4777 0.809152 14.1295C0.898438 15.7366 1.25558 17.1205 2.41629 18.3259C3.62165 19.4866 5.00558 19.8438 6.61272 19.933C8.26451 20.0223 13.2199 20.0223 14.8717 19.933C16.4788 19.8438 17.9074 19.4866 19.0681 18.3259C20.2288 17.1205 20.5859 15.7366 20.6752 14.1295C20.7645 12.4777 20.7645 7.52232 20.6752 5.87054ZM18.5324 15.8705C18.2199 16.7634 17.5056 17.433 16.6574 17.7902C15.3181 18.3259 12.1931 18.192 10.7645 18.192C9.2913 18.192 6.16629 18.3259 4.87165 17.7902C3.97879 17.433 3.30915 16.7634 2.95201 15.8705C2.41629 14.5759 2.55022 11.4509 2.55022 9.97768C2.55022 8.54911 2.41629 5.42411 2.95201 4.08482C3.30915 3.23661 3.97879 2.56696 4.87165 2.20982C6.16629 1.67411 9.2913 1.80804 10.7645 1.80804C12.1931 1.80804 15.3181 1.67411 16.6574 2.20982C17.5056 2.52232 18.1752 3.23661 18.5324 4.08482C19.0681 5.42411 18.9342 8.54911 18.9342 9.97768C18.9342 11.4509 19.0681 14.5759 18.5324 15.8705Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="26" height="20" viewBox="0 0 26 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.8627 4.96386C23.8265 4.24096 24.694 3.37349 25.3687 2.36145C24.5012 2.74699 23.4892 3.03614 22.4771 3.13253C23.5374 2.50602 24.3085 1.54217 24.694 0.337349C23.7301 0.915663 22.6217 1.3494 21.5133 1.59036C20.5494 0.578313 19.2482 0 17.8024 0C15.0072 0 12.7422 2.26506 12.7422 5.06024C12.7422 5.44578 12.7904 5.83133 12.8868 6.21687C8.69399 5.9759 4.93496 3.95181 2.42893 0.915663C1.9952 1.63855 1.75424 2.50602 1.75424 3.46988C1.75424 5.20482 2.62171 6.74699 4.0193 7.66265C3.20002 7.61446 2.38074 7.42169 1.70604 7.03614V7.08434C1.70604 9.54217 3.44098 11.5663 5.75424 12.0482C5.36869 12.1446 4.88677 12.241 4.45303 12.241C4.11568 12.241 3.82652 12.1928 3.48918 12.1446C4.11568 14.1687 5.9952 15.6145 8.21207 15.6627C6.47713 17.012 4.30845 17.8313 1.94701 17.8313C1.51327 17.8313 1.12773 17.7831 0.742188 17.7349C2.95906 19.1807 5.60966 20 8.50122 20C17.8024 20 22.8627 12.3373 22.8627 5.63855C22.8627 5.39759 22.8627 5.20482 22.8627 4.96386Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a href="#" className="text-center d-center">
                          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.54036 0C4.41469 0 0.369141 2.72374 0.369141 7.16984C0.369141 9.97369 1.93128 11.5759 2.8926 11.5759C3.29315 11.5759 3.53348 10.4944 3.53348 10.174C3.53348 9.81347 2.57216 9.01237 2.57216 7.45023C2.57216 4.24583 5.01552 1.96269 8.17986 1.96269C10.9437 1.96269 12.9464 3.52484 12.9464 6.36874C12.9464 8.49166 12.1052 12.4571 9.34146 12.4571C8.34008 12.4571 7.45887 11.7361 7.45887 10.7347C7.45887 9.21264 8.54036 7.73061 8.54036 6.16847C8.54036 3.52484 4.77519 4.0055 4.77519 7.2099C4.77519 7.89083 4.8553 8.61182 5.17574 9.2527C4.61497 11.6159 3.49343 15.1808 3.49343 17.6242C3.49343 18.3852 3.57354 19.1062 3.65365 19.8673C3.77381 20.0275 3.73376 20.0275 3.93403 19.9474C5.93678 17.1836 5.89673 16.6228 6.77794 13.0179C7.29865 13.9391 8.54036 14.4598 9.58179 14.4598C13.8276 14.4598 15.7503 10.2941 15.7503 6.56902C15.7503 2.60357 12.3055 0 8.54036 0Z" fill="#454750" />
                          </svg>
                        </a>
                      </li>
                    </ul>
                  </div>
                  <div className="content">
                    <span className="bspan-clr position-relative mb-xxl-4 mb-xxl-3 mb-3">CEO</span>
                    <h5 className="white-clr">
                      <a href="/team/details" className="white-clr whitehover">Esther Howard</a>
                    </h5>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Cmn Team version01 End */}
        {/* Text SLider Start */}
        <div className="digital-solution testi-italic mb-xxl-4 pb-lg-0 pb-15">
          <div className="mycustom-marque">
            <div className="scrolling-wrap">
              <div className="comm">
                <div className="cmn-textslide textitalick">Client’s testimonial</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Client’s testimonial</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide textitalick">Client’s testimonial</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Client’s testimonial</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
              </div>
              <div className="comm">
                <div className="cmn-textslide textitalick">Client’s testimonial</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Client’s testimonial</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide textitalick">Client’s testimonial</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Client’s testimonial</div>
                <div>
                  <img src="/site/assets/img/client/text-slide.png" alt="img" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Text Slider End */}
        {/* Version01 Testimonial Start */}
        <section className="testimonial-version01-section pt-20 pb-space position-relative">
          <div className="container">
            <div className="row g-4">
              <div className="col-lg-11">
                <div className="swiper testimonial-version01 position-relative">
                  <div className="swiper-wrapper">
                    <div className="swiper-slide">
                      <div className="testimonial-zero-oneitem d-md-flex d-grid align-items-center justify-content-md-start justify-content-center text-md-start text-center gap-xxl-7 gap-xl-5 gap-4">
                        <div className="thumb">
                          <img src="/site/assets/img/testimonial/t-version01.png" alt="img" />
                        </div>
                        <div className="vector d-md-block d-none">
                          <img src="/site/assets/img/testimonial/vector01.png" alt="img" />
                        </div>
                        <div className="content ps-md-10">
                          <div className="icon mb-xxl-6 mb-xl-5 mb-4">
                            <SiteIcon name="quote" className="theme-clr" solid />
                          </div>
                          <p className="white-clr mb-xxl-7 mb-xl-6 mb-lg-5 mb-4">
                            Posuere luctus orci. Donec vitae mattis quam, vitae tempor arcu. Aenean non odio porttitor, convallis erat sit amet, facilisis velit. Nulla ornare convallis malesuada. Phasellus molestie, ipsum ac fringilla.
                          </p>
                          <div className="desig">
                            <h6 className="white-clr mb-2">Daniel Smith</h6>
                            <span className="theme-clr">Senior engineer</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="slider-button gap-xxl-3 gap-2 align-items-center justify-content-between slider-button-60">
            <button className="cmn-prev cmn-border d-center" tabIndex={0} aria-label="Next slide">
              <SiteIcon name="chevron-up" />
            </button>
            {" "}
            <button className="cmn-next cmn-border d-center" tabIndex={0} aria-label="Previous slide">
              <SiteIcon name="chevron-down" />
            </button>
          </div>
        </section>
        {/* Version01 Testimonial End */}
        {/* Version01 BLog One Start */}
        <section className="home-blog-version1 pb-space pt-space">
          <div className="container zindex position-relative">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-5 mb-xxl-15 mb-xl-12 mb-lg-10 mb-md-10 mb-sm-10 mb-9">
              <div className="pricing-title">
                <div className="radius-btn text-uppercase cmn-border d-inline-flex radius100 py-xxl-2 py-2 px-xxl-4 px-4 theme-clr gap-xxl-4 gap-3 mb-xxl-8 mb-xl-6 mb-5">
                  BLOG &amp; News
                  {" "}
                  <span className="rot60 d-inline-block">
                    <SiteIcon name="arrow-up" className="theme-clr" />
                  </span>
                </div>
                <h2 className="stitle">
                  Check Our
                  {" "}
                  <span className="fw-400">Company</span>
                  {" "}
                  <span className="d-block fw-semibold">Inside Story</span>
                </h2>
              </div>
              <a href="/blog" className="radius-btn d-inline-flex radius100 py-xxl-2 py-2 px-xxl-5 px-5 theme-border theme-clr gap-xxl-4 gap-3 mb-xxl-8 mb-xl-6 mb-5">View all Artcile</a>
            </div>
            <div className="row g-xxl-7 g-xl-6 g-4">
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
            </div>
          </div>
        </section>
        {/* Version01 BLog One End */}
        {/* Text SLider Start */}
        <div className="digital-solution home-onetext pb-20 mb-xxl-5">
          <div className="mycustom-marque">
            <div className="scrolling-wrap">
              <div className="comm">
                <div className="cmn-textslide textitalick">Let’s talk!</div>
                <div>
                  <img src="/site/assets/img/footer/let-arrow.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Let’s talk!</div>
                <div>
                  <img src="/site/assets/img/footer/let-arrow.png" alt="img" />
                </div>
                <div className="cmn-textslide textitalick">Let’s talk!</div>
                <div>
                  <img src="/site/assets/img/footer/let-arrow.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Let’s talk!</div>
                <div>
                  <img src="/site/assets/img/footer/let-arrow.png" alt="img" />
                </div>
                <div className="cmn-textslide textitalick">Let’s talk!</div>
              </div>
              <div className="comm">
                <div className="cmn-textslide textitalick">Let’s talk!</div>
                <div>
                  <img src="/site/assets/img/footer/let-arrow.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Let’s talk!</div>
                <div>
                  <img src="/site/assets/img/footer/let-arrow.png" alt="img" />
                </div>
                <div className="cmn-textslide textitalick">Let’s talk!</div>
                <div>
                  <img src="/site/assets/img/footer/let-arrow.png" alt="img" />
                </div>
                <div className="cmn-textslide text-custom-storke">Let’s talk!</div>
                <div>
                  <img src="/site/assets/img/footer/let-arrow.png" alt="img" />
                </div>
                <div className="cmn-textslide textitalick">Let’s talk!</div>
              </div>
            </div>
          </div>
        </div>
        {/* Text Slider End */}
      </main>
    </SitePage>
  );
}

import { SiteIcon } from "./SiteIcon";

/**
 * The 404 page's content, ported as-is from the HOK template's `oops.html`.
 * Rendered by app/global-not-found.tsx for any URL that matches no route.
 */
export function NotFoundMain() {
  return (
    <main className="main">
      {/* Breadcrumnd Banner */}
      <section className="breadcrumnd-banner position-relative">
        <div className="container">
          <div className="row g-5 justify-content-center">
            <div className="col-lg-5">
              <div className="breadcrumnd-content text-center">
                <h1 className="white mb-xxl-10 mb-xl-8 mb-6" data-aos="zoom-in-left" data-aos-duration="1800">Error Page</h1>
                <ul className="breadcrumnd d-inline-flex align-items-center gap-2 pra-border radius100 py-xxl-3 py-2 px-xxl-4 px-4" data-aos="zoom-in-right" data-aos-duration="2000">
                  <li>
                    <a href="/" className="text-uppercase htheme">Home</a>
                  </li>
                  <li>
                    <span className="rot60 d-inline-block">
                      <SiteIcon name="arrow-up" />
                    </span>
                  </li>
                  <li className="theme-clr">Error Page</li>
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
      {/* Error Oops Start */}
      <section className="blog-grid pt-space pb-space">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-6">
              <div className="error-content text-center">
                <div className="thumb mb-xxl-15 mb-xl-10 mb-lg-8 mb-md-6 mb-5 w-100" data-aos="zoom-in" data-aos-duration="1400">
                  <img src="/site/assets/img/error/opps.png" alt="img" className="w-100" />
                </div>
                <h2 className="white-clr mb-xxl-7 mb-xl-6 mb-5">
                  <span className="theme-clr">Oops!</span>
                  {" "}
                  Page not found
                </h2>
                <p className="white-clr mb-xxl-12 mb-xl-9 mb-lg-8 mb-5">The page you are looking for does not exist</p>
                <a href="/" className="cmn-btn themebg py-xxl-4 py-3 px-xxl-6 px-5 text-whitess">Back To Home Page</a>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Error Oops End */}
    </main>
  );
}

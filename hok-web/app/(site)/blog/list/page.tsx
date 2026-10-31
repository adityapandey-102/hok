import type { Metadata } from "next";
import { SitePage } from "@/modules/site/components/SitePage";
import { SiteIcon } from "@/modules/site/components/SiteIcon";

/** Ported as-is from the HOK template's `blog-list.html` (see README "Portfolio"). */
export const metadata: Metadata = { title: "Blog list" };

export default function BlogListPage() {
  return (
    <SitePage variant="inner">
      <main className="main">
        {/* Breadcrumnd Banner */}
        <section className="breadcrumnd-banner position-relative">
          <div className="container">
            <div className="row g-5 justify-content-center">
              <div className="col-lg-5">
                <div className="breadcrumnd-content text-center">
                  <h1 className="white mb-xxl-10 mb-xl-8 mb-6" data-aos="zoom-in-left" data-aos-duration="1800">Blog List</h1>
                  <ul className="breadcrumnd d-inline-flex align-items-center gap-2 pra-border radius100 py-xxl-3 py-2 px-xxl-4 px-4" data-aos="zoom-in-right" data-aos-duration="2000">
                    <li>
                      <a href="/" className="text-uppercase htheme">Home</a>
                    </li>
                    <li>
                      <span className="rot60 d-inline-block">
                        <SiteIcon name="arrow-up" />
                      </span>
                    </li>
                    <li className="theme-clr">Blog List</li>
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
        {/* Blog List Start */}
        <section className="blog-list pt-space pb-space">
          <div className="container">
            <div className="row g-5">
              <div className="col-12 col-lg-8">
                <div className="blog-post-details">
                  <div className="single-blog-post cmn-border p-xxl-7 p-xl-6 p-lg-4 p-3 mb-xxl-7 mb-xl-7 mb-lg-6 mb-5">
                    <div className="post-featured-thumb w-100 mb-xxl-7 mb-xl-6 mb-5" data-aos="zoom-in" data-aos-duration="1400">
                      <img src="/site/assets/img/blog/blog-details-b2.png" alt="img" className="w-100" />
                    </div>
                    <div className="post-content">
                      <div className="post-marry d-flex align-items-center gap-xxl-8 gap-xl-6 gap-4 gap-3 mb-xxl-6 mb-xl-5 mb-sm-4 mb-3" data-aos="fade-left" data-aos-duration="1500">
                        <span>
                          Written by:
                          {" "}
                          <span className="tag-clr">Marry biden</span>
                        </span>
                        {" "}
                        <SiteIcon name="circle" solid className="white" />
                        {" "}
                        <span className="tag-clr">10/01/2024</span>
                      </div>
                      <h5 className="white mb-xxl-8 mb-xl-7 mb-sm-6 mb-5" data-aos="fade-left" data-aos-duration="1600">Free advertising for your online</h5>
                      <p className="pra-clr mb-xxl-10 mb-xl-8 mb-sm-7 mb-6" data-aos="fade-left" data-aos-duration="1550">
                        Consectetur adipisicing elit, sed do eiusmod tempor is incididunt ut labore et dolore of magna aliqua. Ut enim ad minim veniam, made of owl the quis nostrud exercitation ullamco laboris nisi.
                      </p>
                      <div className="d-flex align-items-center justify-content-between">
                        <a href="/blog/details" className="blog-singelbtn d-center whitebg" data-aos="zoom-in" data-aos-duration="1400">
                          <SiteIcon name="arrow-right" />
                        </a>
                        {" "}
                        <a href="/blog/details" className="shapre-btn d-flex align-items-center gap-2 cmn-border py-xxl-3 py-2 px-xxl-6 px-4 pra-clr" data-aos="zoom-in-right" data-aos-duration="1600">
                          Share
                          {" "}
                          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.5471 14.7982C14.493 14.7982 13.5433 15.2534 12.8842 15.9775L6.95572 12.3057C7.11849 11.8896 7.20194 11.4467 7.20176 11C7.20197 10.5532 7.11852 10.1103 6.95572 9.69429L12.8842 6.02232C13.5434 6.74642 14.493 7.20181 15.5471 7.20181C17.5327 7.20181 19.1481 5.58644 19.1481 3.60082C19.1481 1.61519 17.5327 0 15.5471 0C13.5615 0 11.9461 1.61536 11.9461 3.60099C11.9461 4.04774 12.0295 4.49056 12.1922 4.90663L6.26384 8.57848C5.6047 7.85437 4.65505 7.39899 3.60099 7.39899C1.61536 7.39899 0 9.01453 0 11C0 12.9856 1.61536 14.601 3.60099 14.601C4.65501 14.601 5.60475 14.1458 6.26384 13.4215L12.1922 17.0933C12.0295 17.5094 11.9461 17.9523 11.9461 18.3991C11.9461 20.3846 13.5615 22 15.5471 22C17.5327 22 19.1481 20.3846 19.1481 18.3992C19.1481 16.4135 17.5327 14.7982 15.5471 14.7982ZM13.2592 3.60099C13.2592 2.33943 14.2856 1.31308 15.5471 1.31308C16.8086 1.31308 17.835 2.33943 17.835 3.60099C17.835 4.86255 16.8087 5.8889 15.5471 5.8889C14.2855 5.8889 13.2592 4.86251 13.2592 3.60099ZM3.60099 13.2879C2.33926 13.2879 1.31291 12.2615 1.31291 11C1.31291 9.73846 2.33926 8.71207 3.60099 8.71207C4.86255 8.71207 5.88873 9.73846 5.88873 11C5.88873 12.2615 4.86251 13.2879 3.60099 13.2879ZM13.2592 18.399C13.2592 17.1375 14.2856 16.1111 15.5471 16.1111C16.8086 16.1111 17.835 17.1375 17.835 18.399C17.835 19.6605 16.8087 20.6869 15.5471 20.6869C14.2855 20.6869 13.2592 19.6605 13.2592 18.399V18.399Z" fill="#E3FF04" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="single-blog-post cmn-border p-xxl-7 p-xl-6 p-lg-4 p-3 mb-xxl-7 mb-xl-7 mb-lg-6 mb-5">
                    <div className="post-featured-thumb w-100 mb-xxl-7 mb-xl-6 mb-5" data-aos="zoom-in" data-aos-duration="1400">
                      <img src="/site/assets/img/blog/blog-details-b3.png" alt="img" className="w-100" />
                    </div>
                    <div className="post-content">
                      <div className="post-marry d-flex align-items-center gap-xxl-8 gap-xl-6 gap-4 gap-3 mb-xxl-6 mb-xl-5 mb-sm-4 mb-3" data-aos="fade-left" data-aos-duration="1500">
                        <span>
                          Written by:
                          {" "}
                          <span className="tag-clr">Marry biden</span>
                        </span>
                        {" "}
                        <SiteIcon name="circle" solid className="white" />
                        {" "}
                        <span className="tag-clr">10/01/2024</span>
                      </div>
                      <h5 className="white mb-xxl-8 mb-xl-7 mb-sm-6 mb-5" data-aos="fade-left" data-aos-duration="1600">Creating new working in the digital</h5>
                      <p className="pra-clr mb-xxl-10 mb-xl-8 mb-sm-7 mb-6" data-aos="fade-left" data-aos-duration="1550">
                        Consectetur adipisicing elit, sed do eiusmod tempor is incididunt ut labore et dolore of magna aliqua. Ut enim ad minim veniam, made of owl the quis nostrud exercitation ullamco laboris nisi.
                      </p>
                      <div className="d-flex align-items-center justify-content-between">
                        <a href="/blog/details" className="blog-singelbtn d-center whitebg" data-aos="zoom-in" data-aos-duration="1400">
                          <SiteIcon name="arrow-right" />
                        </a>
                        {" "}
                        <a href="/blog/details" className="shapre-btn d-flex align-items-center gap-2 cmn-border py-xxl-3 py-2 px-xxl-6 px-4 pra-clr" data-aos="zoom-in-right" data-aos-duration="1600">
                          Share
                          {" "}
                          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.5471 14.7982C14.493 14.7982 13.5433 15.2534 12.8842 15.9775L6.95572 12.3057C7.11849 11.8896 7.20194 11.4467 7.20176 11C7.20197 10.5532 7.11852 10.1103 6.95572 9.69429L12.8842 6.02232C13.5434 6.74642 14.493 7.20181 15.5471 7.20181C17.5327 7.20181 19.1481 5.58644 19.1481 3.60082C19.1481 1.61519 17.5327 0 15.5471 0C13.5615 0 11.9461 1.61536 11.9461 3.60099C11.9461 4.04774 12.0295 4.49056 12.1922 4.90663L6.26384 8.57848C5.6047 7.85437 4.65505 7.39899 3.60099 7.39899C1.61536 7.39899 0 9.01453 0 11C0 12.9856 1.61536 14.601 3.60099 14.601C4.65501 14.601 5.60475 14.1458 6.26384 13.4215L12.1922 17.0933C12.0295 17.5094 11.9461 17.9523 11.9461 18.3991C11.9461 20.3846 13.5615 22 15.5471 22C17.5327 22 19.1481 20.3846 19.1481 18.3992C19.1481 16.4135 17.5327 14.7982 15.5471 14.7982ZM13.2592 3.60099C13.2592 2.33943 14.2856 1.31308 15.5471 1.31308C16.8086 1.31308 17.835 2.33943 17.835 3.60099C17.835 4.86255 16.8087 5.8889 15.5471 5.8889C14.2855 5.8889 13.2592 4.86251 13.2592 3.60099ZM3.60099 13.2879C2.33926 13.2879 1.31291 12.2615 1.31291 11C1.31291 9.73846 2.33926 8.71207 3.60099 8.71207C4.86255 8.71207 5.88873 9.73846 5.88873 11C5.88873 12.2615 4.86251 13.2879 3.60099 13.2879ZM13.2592 18.399C13.2592 17.1375 14.2856 16.1111 15.5471 16.1111C16.8086 16.1111 17.835 17.1375 17.835 18.399C17.835 19.6605 16.8087 20.6869 15.5471 20.6869C14.2855 20.6869 13.2592 19.6605 13.2592 18.399V18.399Z" fill="#E3FF04" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="single-blog-post cmn-border p-xxl-7 p-xl-6 p-lg-4 p-3 mb-xxl-7 mb-xl-7 mb-lg-6 mb-5">
                    <div className="post-featured-thumb w-100 mb-xxl-7 mb-xl-6 mb-5" data-aos="zoom-in" data-aos-duration="1400">
                      <img src="/site/assets/img/blog/blog-details-b1.png" alt="img" className="w-100" />
                    </div>
                    <div className="post-content">
                      <div className="post-marry d-flex align-items-center gap-xxl-8 gap-xl-6 gap-4 gap-3 mb-xxl-6 mb-xl-5 mb-sm-4 mb-3" data-aos="fade-left" data-aos-duration="1500">
                        <span>
                          Written by:
                          {" "}
                          <span className="tag-clr">Marry biden</span>
                        </span>
                        {" "}
                        <SiteIcon name="circle" solid className="white" />
                        {" "}
                        <span className="tag-clr">10/01/2024</span>
                      </div>
                      <h5 className="white mb-xxl-8 mb-xl-7 mb-sm-6 mb-5" data-aos="fade-left" data-aos-duration="1600">Free advertising for your online</h5>
                      <p className="pra-clr mb-xxl-10 mb-xl-8 mb-sm-7 mb-6" data-aos="fade-left" data-aos-duration="1550">
                        Consectetur adipisicing elit, sed do eiusmod tempor is incididunt ut labore et dolore of magna aliqua. Ut enim ad minim veniam, made of owl the quis nostrud exercitation ullamco laboris nisi.
                      </p>
                      <div className="d-flex align-items-center justify-content-between">
                        <a href="/blog/details" className="blog-singelbtn d-center whitebg" data-aos="zoom-in" data-aos-duration="1400">
                          <SiteIcon name="arrow-right" />
                        </a>
                        {" "}
                        <a href="/blog/details" className="shapre-btn d-flex align-items-center gap-2 cmn-border py-xxl-3 py-2 px-xxl-6 px-4 pra-clr" data-aos="zoom-in-right" data-aos-duration="1600">
                          Share
                          {" "}
                          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.5471 14.7982C14.493 14.7982 13.5433 15.2534 12.8842 15.9775L6.95572 12.3057C7.11849 11.8896 7.20194 11.4467 7.20176 11C7.20197 10.5532 7.11852 10.1103 6.95572 9.69429L12.8842 6.02232C13.5434 6.74642 14.493 7.20181 15.5471 7.20181C17.5327 7.20181 19.1481 5.58644 19.1481 3.60082C19.1481 1.61519 17.5327 0 15.5471 0C13.5615 0 11.9461 1.61536 11.9461 3.60099C11.9461 4.04774 12.0295 4.49056 12.1922 4.90663L6.26384 8.57848C5.6047 7.85437 4.65505 7.39899 3.60099 7.39899C1.61536 7.39899 0 9.01453 0 11C0 12.9856 1.61536 14.601 3.60099 14.601C4.65501 14.601 5.60475 14.1458 6.26384 13.4215L12.1922 17.0933C12.0295 17.5094 11.9461 17.9523 11.9461 18.3991C11.9461 20.3846 13.5615 22 15.5471 22C17.5327 22 19.1481 20.3846 19.1481 18.3992C19.1481 16.4135 17.5327 14.7982 15.5471 14.7982ZM13.2592 3.60099C13.2592 2.33943 14.2856 1.31308 15.5471 1.31308C16.8086 1.31308 17.835 2.33943 17.835 3.60099C17.835 4.86255 16.8087 5.8889 15.5471 5.8889C14.2855 5.8889 13.2592 4.86251 13.2592 3.60099ZM3.60099 13.2879C2.33926 13.2879 1.31291 12.2615 1.31291 11C1.31291 9.73846 2.33926 8.71207 3.60099 8.71207C4.86255 8.71207 5.88873 9.73846 5.88873 11C5.88873 12.2615 4.86251 13.2879 3.60099 13.2879ZM13.2592 18.399C13.2592 17.1375 14.2856 16.1111 15.5471 16.1111C16.8086 16.1111 17.835 17.1375 17.835 18.399C17.835 19.6605 16.8087 20.6869 15.5471 20.6869C14.2855 20.6869 13.2592 19.6605 13.2592 18.399V18.399Z" fill="#E3FF04" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="blog-right-bar mt-lg-0 mt-4">
                  <div className="box mb-xxl-10 mb-xl-8 mb-7">
                    <div className="wid-title" data-aos="fade-left" data-aos-duration="1600">
                      <h6>Search</h6>
                    </div>
                    <div className="search-widget" data-aos="zoom-in" data-aos-duration="1400">
                      <form action="#">
                        <input type="text" placeholder="Search here..." />
                        {" "}
                        <button type="submit">
                          <SiteIcon name="search" />
                        </button>
                      </form>
                    </div>
                  </div>
                  <div className="box mb-xxl-10 mb-xl-8 mb-7">
                    <div className="wid-title" data-aos="fade-left" data-aos-duration="1600">
                      <h6>Cagegories</h6>
                    </div>
                    <div className="category" data-aos="fade-down" data-aos-duration="1600">
                      <ul className="d-grid gap-xxl-3 gap-3">
                        <li>
                          <a href="/blog/details">
                            Business
                            {" "}
                            <span>(2)</span>
                          </a>
                        </li>
                        <li>
                          <a href="/blog/details">
                            Job Market
                            {" "}
                            <span>(4)</span>
                          </a>
                        </li>
                        <li>
                          <a href="/blog/details">
                            Marketing
                            {" "}
                            <span>(3)</span>
                          </a>
                        </li>
                        <li>
                          <a href="/blog/details">
                            News
                            {" "}
                            <span>(5)</span>
                          </a>
                        </li>
                        <li>
                          <a href="/blog/details">
                            Social Media
                            {" "}
                            <span>(7)</span>
                          </a>
                        </li>
                        <li>
                          <a href="/blog/details">
                            Trends
                            {" "}
                            <span>(8)</span>
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="box mb-xxl-10 mb-xl-8 mb-7">
                    <div className="wid-title" data-aos="fade-left" data-aos-duration="1600">
                      <h6>Recent Posts</h6>
                    </div>
                    <div className="recent-postwrap">
                      <div className="recent-items d-flex align-items-center gap-xxl-5 gap-xl-4 gap-lg-3 gap-2" data-aos="fade-down" data-aos-duration="1200">
                        <div className="recent-thumb">
                          <img src="/site/assets/img/blog/details-small1.png" alt="img" />
                        </div>
                        <div className="recent-content">
                          <span className="pra-clr d-block mb-1">12/01/2024</span>
                          {" "}
                          <a href="/blog/details">
                            Guide dog shortage: The blind peo ple who train their own guide
                          </a>
                        </div>
                      </div>
                      <div className="recent-items d-flex align-items-center gap-xxl-5 gap-xl-4 gap-lg-3 gap-2" data-aos="fade-down" data-aos-duration="1400">
                        <div className="recent-thumb">
                          <img src="/site/assets/img/blog/details-small2.png" alt="img" />
                        </div>
                        <div className="recent-content">
                          <span className="pra-clr d-block mb-1">12/01/2024</span>
                          {" "}
                          <a href="/blog/details">
                            Guide dog shortage: The blind peo ple who train their own guide
                          </a>
                        </div>
                      </div>
                      <div className="recent-items d-flex align-items-center gap-xxl-5 gap-xl-4 gap-lg-3 gap-2" data-aos="fade-down" data-aos-duration="1600">
                        <div className="recent-thumb">
                          <img src="/site/assets/img/blog/details-small3.png" alt="img" />
                        </div>
                        <div className="recent-content">
                          <span className="pra-clr d-block mb-1">12/01/2024</span>
                          {" "}
                          <a href="/blog/details">
                            Guide dog shortage: The blind peo ple who train their own guide
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="box">
                    <div className="wid-title" data-aos="fade-left" data-aos-duration="1600">
                      <h6>Tag</h6>
                    </div>
                    <div className="tagwrap d-flex flex-wrap gap-xl-6 gap-lg-4 gap-md-3 gap-2">
                      <a href="/blog/details">nature</a>
                      {" "}
                      <a href="/blog/details">health</a>
                      {" "}
                      <a href="/blog/details">galaxy</a>
                      {" "}
                      <a href="/blog/details">creative</a>
                      {" "}
                      <a href="/blog/details">art</a>
                      {" "}
                      <a href="/blog/details">business</a>
                      {" "}
                      <a href="/blog/details">space</a>
                      {" "}
                      <a href="/blog/details">biology</a>
                      {" "}
                      <a href="/blog/details">environemnt</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* Blog List End */}
      </main>
    </SitePage>
  );
}

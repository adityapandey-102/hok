import type { Metadata } from "next";
import { SitePage } from "@/modules/site/components/SitePage";
import { SiteIcon } from "@/modules/site/components/SiteIcon";

/** Ported as-is from the HOK template's `blog-details.html` (see README "Portfolio"). */
export const metadata: Metadata = { title: "Blog details" };

export default function BlogDetailsPage() {
  return (
    <SitePage variant="inner">
      <main className="main">
        {/* Breadcrumnd Banner */}
        <section className="breadcrumnd-banner position-relative">
          <div className="container">
            <div className="row g-5 justify-content-center">
              <div className="col-lg-5">
                <div className="breadcrumnd-content text-center">
                  <h1 className="white mb-xxl-10 mb-xl-8 mb-6" data-aos="zoom-in-left" data-aos-duration="1800">Blog Details</h1>
                  <ul className="breadcrumnd d-inline-flex align-items-center gap-2 pra-border radius100 py-xxl-3 py-2 px-xxl-4 px-4" data-aos="zoom-in-right" data-aos-duration="2000">
                    <li>
                      <a href="/" className="text-uppercase htheme">Home</a>
                    </li>
                    <li>
                      <span className="rot60 d-inline-block">
                        <SiteIcon name="arrow-up" />
                      </span>
                    </li>
                    <li className="theme-clr">Blog Details</li>
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
        {/* Blog Details Start */}
        <section className="blog-details pt-space pb-space">
          <div className="container">
            <div className="row g-5">
              <div className="col-12 col-lg-8">
                <div className="blog-post-details mb-xxl-10 mb-xl-8 mb-lg-7 mb-6">
                  <div className="single-blog-post">
                    <div className="post-featured-thumb w-100 mb-xxl-30 mb-xl-6 mb-5" data-aos="zoom-in" data-aos-duration="1400">
                      <img src="/site/assets/img/blog/blog-details-b1.png" alt="img" className="w-100" />
                    </div>
                    <div className="post-content">
                      <div className="post-marry d-flex align-items-center gap-xxl-8 gap-xl-6 gap-4 gap-3 mb-xxl-5 mb-xl-4 mb-lg-3 mb-3" data-aos="fade-left" data-aos-duration="1500">
                        <span>Written by: Marry biden</span>
                        {" "}
                        <SiteIcon name="circle" solid className="white" />
                        {" "}
                        <span>10/01/2024</span>
                      </div>
                      <div className="mb-xxl-13 mb-xl-10 mb-lg-8 mb-7">
                        <h5 className="white mb-xxl-5 mb-3" data-aos="fade-left" data-aos-duration="1600">Guide dog shortage: The blind people who train their</h5>
                        <p className="pra-clr mb-xxl-5 mb-3" data-aos="fade-left" data-aos-duration="1550">
                          Proin ultricies ultricies est vitae cursus. Nulla sit amet suscipit tortor. Maecenas dui erat, ornare eget tristique vitae, rutrum pretium justo. Phasellus vitae consequat nisi, quis luctus nisl. Praesent faucibus sem id massa semper ornare. Nam eu magna at mi pellentesque mattis. Morbi at condimentum velit. Phasellus aliquet, leo auctor volutpat ultrices, metus dolor dictum enim, sed convallis lacus urna nec erat.
                        </p>
                        <p className="pra-clr" data-aos="fade-left" data-aos-duration="1700">
                          consectetur adipiscing elit. Etiam at mauris accumsan mi pulvinar lacinia a in justo. Ut tempor et libero quis dignissim. Nulla at convallis libero, vitae aliquam leo. Etiam ut augue nibh. In laoreet neque quis ex ornare, quis auctor elit facilisis. Mauris dapibus massa rhoncus ligula luctus vulputate. Fusce condimentum placerat vulputate. Praesent ullamcorper dui in dui sagittis commodo.
                        </p>
                      </div>
                      <h5 className="white mb-xxl-10 mb-xl-7 mb-lg-6 mb-4" data-aos="zoom-in-left" data-aos-duration="1400">Where can I get some?</h5>
                      <div className="row g-xl-4 g-3 mb-xxl-10 mb-xl-7 mb-lg-6 mb-4">
                        <div className="col-lg-6 col-md-6 col-sm-6" data-aos="zoom-in" data-aos-duration="1500">
                          <div className="details-thumb-b1 w-100">
                            <img src="/site/assets/img/blog/blog-details-s2.png" alt="img" className="w-100" />
                          </div>
                        </div>
                        <div className="col-lg-6 col-md-6 col-sm-6" data-aos="zoom-in" data-aos-duration="1600">
                          <div className="details-thumb-b1 w-100">
                            <img src="/site/assets/img/blog/blog-details-s1.png" alt="img" className="w-100" />
                          </div>
                        </div>
                      </div>
                      <p className="pra-clr mb-xxl-8 mb-xl-6 mb-lg-5 mb-4" data-aos="zoom-in-left" data-aos-duration="1400">
                        Proin ultricies ultricies est vitae cursus. Nulla sit amet suscipit tortor. Maecenas dui erat, ornare eget tristique vitae, rutrum pretium justo. Phasellus vitae consequat nisi, quis luctus nisl. Praesent faucibus sem id massa semper ornare. Nam eu magna at mi pellentesque mattis. Morbi at condimentum velit. Phasellus aliquet, leo auctor volutpat ultrices, metus dolor dictum enim, sed convallis lacus urna nec erat.
                      </p>
                      <ul className="blod-dlist d-grid gap-xl-2 gap-2 mb-xxl-8 mb-xl-6 mb-lg-5 mb-4">
                        <li>Mauris maximus diam ac imperdiet dictum.</li>
                        <li>
                          Maecenas eget ipsum dapibus, rutrum mi non, ultricies massa.
                        </li>
                        <li>Nam non purus porta risus tincidunt cursus.</li>
                        <li>Quisque blandit lacus vel urna pellentesque mattis.</li>
                        <li>Maecenas vehicula tortor et consectetur faucibus.</li>
                      </ul>
                      <div className="hilight-text py-xxl-12 py-xl-9 py-lg-7 py-sm-6 py-4 px-xxl-20 px-xl-15 px-lg-10 px-sm-8 px-4 mb-xxl-8 mb-xl-6 mb-lg-5 mb-4" data-aos="fade-left" data-aos-duration="1400">
                        <p>
                          &quot;Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit...&quot;
                        </p>
                      </div>
                      <p className="pra-clr" data-aos="zoom-in-left" data-aos-duration="1400">
                        Proin ultricies ultricies est vitae cursus. Nulla sit amet suscipit tortor. Maecenas dui erat, ornare eget tristique vitae, rutrum pretium justo. Phasellus vitae consequat nisi, quis luctus nisl. Praesent faucibus sem id massa semper ornare. Nam eu magna at mi pellentesque mattis.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="tag-share d-sm-flex d-grid align-items-center justify-content-sm-between justify-content-center mb-xxl-8 mb-xl-7 mb-5 gap-3" data-aos="zoom-in" data-aos-duration="1400">
                  <div className="tag d-flex justify-content-sm-start justify-content-center align-items-center gap-xxl-4 gap-3">
                    Tags:
                    <ul className="taglist d-flex align-items-center gap-xxl-3 gap-xl-2 gap-1">
                      <li>
                        <a href="/blog/details" className="tag-clr">Creative</a>
                      </li>
                      <li>
                        <a href="/blog/details" className="tag-clr">Agency</a>
                      </li>
                      <li>
                        <a href="/blog/details" className="tag-clr">Business</a>
                      </li>
                    </ul>
                  </div>
                  <div className="d-flex align-items-center justify-content-sm-start justify-content-center gap-xxl-4 gap-3">
                    Share:
                    <ul className="common-social d-flex align-items-center gap-2">
                      <li data-aos="zoom-in-right" data-aos-duration="1400">
                        <a href="#" className="d-center">
                          <svg width="10" height="16" viewBox="0 0 10 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g opacity="0.8" clipPath="url(#clip0_6308_2802)">
                              <path d="M8.72266 9L9.16703 6.10437H6.38859V4.22531C6.38859 3.43313 6.77672 2.66094 8.02109 2.66094H9.28422V0.195625C9.28422 0.195625 8.13797 0 7.04203 0C4.75391 0 3.25828 1.38688 3.25828 3.8975V6.10437H0.714844V9H3.25828V16H6.38859V9H8.72266Z" fill="white" />
                            </g>
                            <defs>
                              <clipPath id="clip0_6308_2802">
                                <rect width="10" height="16" fill="white" />
                              </clipPath>
                            </defs>
                          </svg>
                        </a>
                      </li>
                      <li data-aos="zoom-in-right" data-aos-duration="1600">
                        <a href="#" className="d-center">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14.3553 4.74149C14.3655 4.88362 14.3655 5.02577 14.3655 5.1679C14.3655 9.5029 11.066 14.4978 5.03553 14.4978C3.17766 14.4978 1.45178 13.9597 0 13.0258C0.263969 13.0562 0.51775 13.0664 0.791875 13.0664C2.32484 13.0664 3.73603 12.5486 4.86294 11.6654C3.42131 11.6349 2.21319 10.6907 1.79694 9.39124C2 9.42168 2.20303 9.44199 2.41625 9.44199C2.71066 9.44199 3.00509 9.40137 3.27919 9.33034C1.77666 9.02574 0.649719 7.70596 0.649719 6.11205V6.07146C1.08625 6.31512 1.59391 6.4674 2.13194 6.48768C1.24869 5.89884 0.670031 4.89377 0.670031 3.75671C0.670031 3.14759 0.832437 2.58921 1.11672 2.1019C2.73094 4.09174 5.15734 5.39121 7.87812 5.53337C7.82737 5.28971 7.79691 5.03593 7.79691 4.78212C7.79691 2.97499 9.25884 1.50293 11.0761 1.50293C12.0202 1.50293 12.873 1.89887 13.472 2.53846C14.2131 2.39634 14.9238 2.12221 15.5532 1.74659C15.3096 2.50802 14.7918 3.14762 14.1116 3.55368C14.7715 3.48265 15.4111 3.29987 15.9999 3.04609C15.5533 3.6958 14.9949 4.27446 14.3553 4.74149V4.74149Z" fill="white" />
                          </svg>
                        </a>
                      </li>
                      <li data-aos="zoom-in-right" data-aos-duration="1900">
                        <a href="#" className="d-center">
                          <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.1769 1.87759C16.9806 1.13853 16.4023 0.556469 15.668 0.358938C14.337 0 9.00014 0 9.00014 0C9.00014 0 3.66327 0 2.3323 0.358938C1.59802 0.5565 1.0197 1.13853 0.823422 1.87759C0.466797 3.21719 0.466797 6.01213 0.466797 6.01213C0.466797 6.01213 0.466797 8.80706 0.823422 10.1467C1.0197 10.8857 1.59802 11.4435 2.3323 11.6411C3.66327 12 9.00014 12 9.00014 12C9.00014 12 14.337 12 15.668 11.6411C16.4023 11.4435 16.9806 10.8857 17.1769 10.1467C17.5335 8.80706 17.5335 6.01213 17.5335 6.01213C17.5335 6.01213 17.5335 3.21719 17.1769 1.87759V1.87759ZM7.25467 8.54972V3.47453L11.7153 6.01219L7.25467 8.54972V8.54972Z" fill="white" />
                          </svg>
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="nextprevius-text d-flex align-items-center justify-content-between mb-xxl-6 mb-xl-5 mb-4">
                  <a href="/blog/details" className="d-flex align-items-center gap-3" data-aos="zoom-in-left" data-aos-duration="1500">
                    <SiteIcon name="arrow-left" />
                    {" "}
                    <span className="dd-clr">Previous blog</span>
                  </a>
                  {" "}
                  <a href="/blog/details" className="dd-clr" data-aos="zoom-in-left" data-aos-duration="1500">Next blog</a>
                </div>
                <div className="row g-xl-7 g-4 mb-xxl-15 mb-xl-10 mb-8">
                  <div className="col-lg-6" data-aos="zoom-in" data-aos-duration="1400">
                    <div className="recent-items bg1-clr d-flex align-items-center gap-xxl-5 gap-xl-4 gap-lg-3 gap-2 py-xxl-6 py-xl-4 py-3 px-xxl-7 px-xl-5 px-lg-4 px-3">
                      <div className="recent-thumb">
                        <img src="/site/assets/img/blog/details-small3.png" alt="img" />
                      </div>
                      <div className="recent-content">
                        <span className="pra-clr d-block mb-1 fs14">12/01/2024</span>
                        {" "}
                        <a href="/blog/details" className="htheme">
                          Guide dog shortage: The blind peo ple who train their own guide
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6" data-aos="zoom-in" data-aos-duration="1400">
                    <div className="recent-items bg1-clr d-flex align-items-center gap-xxl-5 gap-xl-4 gap-lg-3 gap-2 py-xxl-6 py-xl-4 py-3 px-xxl-7 px-xl-5 px-lg-4 px-3">
                      <div className="recent-thumb">
                        <img src="/site/assets/img/blog/details-small4.png" alt="img" />
                      </div>
                      <div className="recent-content">
                        <span className="pra-clr d-block mb-1 fs14">12/01/2024</span>
                        {" "}
                        <a href="/blog/details" className="htheme">
                          Guide dog shortage: The blind peo ple who train their own guide
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="comment-form-wrap" data-aos="zoom-in-left" data-aos-duration="1400">
                  <h3 className="white mb-xxl-7 mb-5">Leave a comments</h3>
                  <form action="#" id="contact-form" method="POST">
                    <div className="row g-xl-7 g-4">
                      <div className="col-lg-6">
                        <div className="form-clt">
                          <input type="text" name="name" id="name" placeholder="Your Name" />
                        </div>
                      </div>
                      <div className="col-lg-6">
                        <div className="form-clt">
                          <input type="text" name="email" id="email2" placeholder="Your Email" />
                        </div>
                      </div>
                      <div className="col-lg-12">
                        <div className="form-clt">
                          <textarea name="message" id="message" placeholder="Write Message" />
                        </div>
                      </div>
                      <div className="col-lg-6">
                        <button type="submit" className="base-btn">
                          post comment
                          {" "}
                          <span className="rotcu">
                            <SiteIcon name="move-right" />
                          </span>
                        </button>
                      </div>
                    </div>
                  </form>
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
        {/* Blog Details End */}
      </main>
    </SitePage>
  );
}

import { SITE_LOGO } from "../brand";

/** Full-screen loading curtain; main.js lifts it on window "load". */
export function Preloader() {
  return (
    <div id="preloader" className="preloader">
      <div className="animation-preloader">
        <div className="spinner" />
        <div className="txt-loading">
          <img src={SITE_LOGO} alt="HOK Logo" style={{ maxHeight: "80px", width: "auto" }} />
        </div>
        <p className="text-center">Loading</p>
      </div>
      <div className="loader">
        <div className="row">
          <div className="col-3 loader-section section-left">
            <div className="bg" />
          </div>
          <div className="col-3 loader-section section-left">
            <div className="bg" />
          </div>
          <div className="col-3 loader-section section-right">
            <div className="bg" />
          </div>
          <div className="col-3 loader-section section-right">
            <div className="bg" />
          </div>
        </div>
      </div>
    </div>
  );
}

import { Logo } from "@/components/brand/logo";

/**
 * The opening curtain, once per visit (like the Reckless site's preloader): night, the ORA mark rising, then the
 * curtain lifts (CSS, ~2 s). A tiny inline script marks a returning visit before paint so the curtain never shows
 * twice in one session; reduced-motion users never see it.
 */
export function SiteIntro() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{if(sessionStorage.getItem('ora.intro')){document.documentElement.setAttribute('data-intro-seen','')}else{sessionStorage.setItem('ora.intro','1')}}catch(e){}",
        }}
      />
      <div aria-hidden className="s-intro ora-site">
        <div className="s-intro__mark flex flex-col items-center gap-5">
          <Logo mark="light" className="h-24 sm:h-28" />
          <span className="s-label text-white/70">Empowering every cycle</span>
        </div>
      </div>
    </>
  );
}

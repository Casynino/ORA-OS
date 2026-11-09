import { IntroAnimation } from "@/components/site/intro-animation";

/**
 * The opening curtain, once per visit. A tiny inline script marks a returning visit before paint (so the curtain never
 * flashes on a second load in the same session); the animation itself lives in IntroAnimation.
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
      <IntroAnimation />
    </>
  );
}

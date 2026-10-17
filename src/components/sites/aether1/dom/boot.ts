import { Experience } from "../gl/experience";
import { AskAether } from "./askAether";
import { Cursor } from "./cursor";
import { ease, gsap, isMobile } from "./eases";
import { Loader } from "./loader";
import { Menu } from "./menu";
import { animateShapes } from "./shapes";
import { SoundToggle } from "./sound";

function setViewportUnits() {
  const root = document.documentElement;
  root.style.setProperty("--vw", `${root.clientWidth * 0.01}px`);
  root.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
}

/** Wires the page: loader → WebGL experience → navigation, sound, cursor and assistant. */
export function boot(root: HTMLElement) {
  const html = document.documentElement;
  html.classList.add("w-mod-js", "is-loaded");
  html.classList.toggle("is-mobile", isMobile());
  setViewportUnits();
  window.addEventListener("resize", setViewportUnits);

  const q = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const navigation = q(".navigation-w");
  const aiForm = q("[data-ai='w']");
  const indicatorIcon = q<SVGElement>(".indicator__icon");
  const indicatorLabel = q(".indicator__label");
  gsap.set(indicatorIcon, { opacity: 0, scale: 0 });
  gsap.set(navigation, { yPercent: -120, opacity: 0 });
  gsap.set(aiForm, { opacity: 0 });

  const loader = new Loader(q(".loader-w"));
  loader.intro();

  const counter = { value: 0 };
  const experience = new Experience({
    canvas: q(".canvas-w"),
    sections: Array.from(root.querySelectorAll<HTMLElement>("section.s")),
    projectedPoints: Array.from(root.querySelectorAll<HTMLElement>(".gl__projected-point")),
    onProgress: (ratio) => {
      gsap.to(counter, {
        value: ratio * 100,
        duration: 2,
        ease: "power2.inOut",
        overwrite: true,
        onUpdate: () => {
          indicatorLabel.textContent = `[ ${Math.floor(counter.value).toString().padStart(3, "0")} ]`;
        },
      });
    },
  });

  let loaded = false;
  let wantsSound = false;
  const audio = {
    turnOn: () => {
      wantsSound = true;
      if (!loaded) return;
      experience.gl.audio.animateAudioIn();
      experience.gl.audio.toggleGlobalVolume(0.2);
    },
    turnOff: () => {
      wantsSound = false;
      experience.gl.audio.toggleGlobalVolume(0);
    },
  };
  const sound = new SoundToggle(q<HTMLButtonElement>(".sound-w"), audio);
  const cursor = new Cursor(q(".cursor"), () => sound.enable());
  const menu = new Menu(q(".navigation"), {
    scrollToStop: (index) => experience.scrollToStop(index),
    playUI: (name) => experience.playUI(name),
  });
  const ask = new AskAether(aiForm, {
    playUI: (name) => experience.playUI(name),
    setIdleScroll: (allowed) => {
      experience.isIdleScrollAllowed = allowed;
    },
  });
  let stopShapes = () => {};

  void experience.load().then(() => {
    loaded = true;
    if (wantsSound) audio.turnOn();
    return loader.outro(() => {
      gsap.killTweensOf(counter);
      indicatorLabel.textContent = "[ 100 ]";
      experience.start();
      gsap
        .timeline({ defaults: { ease: "expo.out", duration: 0.8 } })
        .to(aiForm, { opacity: 1 }, 0)
        .to(navigation, { yPercent: 0, opacity: 1, duration: 1, ease: ease.gentleIn }, 0)
        .to(indicatorIcon, { opacity: 1, scale: 1 }, 0.4)
        .to(indicatorLabel, { text: Loader.indicatorText() }, 0.4);
      html.classList.add("is-ready");
      stopShapes = animateShapes(root);
    });
  });

  return () => {
    window.removeEventListener("resize", setViewportUnits);
    stopShapes();
    loader.dispose();
    cursor.destroy();
    sound.dispose();
    menu.dispose();
    ask.dispose();
    experience.dispose();
    html.classList.remove("is-loaded", "is-ready", "is-loading", "is-mobile");
  };
}

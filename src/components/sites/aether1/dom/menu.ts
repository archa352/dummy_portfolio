import { ease, gsap } from "./eases";

const OPEN = "has-menu-open";

/** Expanding glass navigation panel with section anchors. */
export class Menu {
  private toggleButton: HTMLButtonElement;
  private list: HTMLElement;
  private cta: HTMLElement;
  private tlMenu: gsap.core.Timeline;
  private tlBurger: gsap.core.Timeline;

  constructor(
    private menu: HTMLElement,
    private actions: { scrollToStop: (index: number) => void; playUI: (name: "uiMenuOpen" | "uiMenuClose") => void },
  ) {
    this.toggleButton = menu.querySelector<HTMLButtonElement>("#menu-toggle")!;
    this.list = menu.querySelector<HTMLElement>(".nav__list")!;
    this.cta = menu.querySelector<HTMLElement>(".nav__cta")!;
    const logo = document.querySelector(".nav__logo");
    const logoCircles = document.querySelectorAll(".nav__logo circle:not(:nth-child(5))");
    const burgerCircles = menu.querySelectorAll(".nav__burger circle");

    gsap.set(menu, { height: "4.6rem" });
    this.tlMenu = gsap
      .timeline({ paused: true, defaults: { ease: ease.smoothBlur, duration: 0.6 } })
      .to(menu, { height: "auto", backgroundColor: "rgba(5, 13, 21, 0.8)" })
      .fromTo(menu.querySelector(".nav__line"), { scale: 0, transformOrigin: "center center" }, { scale: 1, ease: "expo.out" }, "<.2")
      .fromTo(menu.querySelectorAll(".nav__link"), { yPercent: -100 }, { yPercent: 0, stagger: 0.05, clearProps: "transform" }, "<")
      .fromTo(this.cta, { opacity: 0, filter: "blur(.5rem)", scale: 1.05 }, { opacity: 1, filter: "blur(0rem)", scale: 1 }, ">-.6");
    this.tlBurger = gsap
      .timeline({ paused: true })
      .to(logo, { rotate: 180, ease: ease.custom })
      .to(
        burgerCircles,
        { scale: 0, transformOrigin: "center center", stagger: { each: 0.1, from: "random", repeat: -1, yoyo: true }, ease: ease.custom, duration: 0.3 },
        "<",
      )
      .to(logoCircles, { scale: 0, transformOrigin: "center center", stagger: { each: 0.1, from: "random" }, ease: ease.custom, duration: 0.3 }, ">-.2");

    this.toggleButton.addEventListener("click", this.toggle);
    this.toggleButton.addEventListener("mouseenter", this.onEnter);
    this.toggleButton.addEventListener("mouseleave", this.onLeave);
    menu.addEventListener("click", this.onMenuClick);
    document.addEventListener("keyup", this.onKeyUp);
  }

  private onEnter = () => this.tlBurger.play();
  private onLeave = () => this.tlBurger.pause().progress(0);
  private onKeyUp = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.close();
  };
  private onOutside = (event: MouseEvent) => {
    if (!this.menu.contains(event.target as Node)) this.close();
  };

  private onMenuClick = (event: MouseEvent) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(".nav__link");
    if (link?.dataset.anchor !== undefined) {
      event.preventDefault();
      this.actions.scrollToStop(Number(link.dataset.anchor));
      this.close();
    }
  };

  private get isOpen() {
    return document.documentElement.classList.contains(OPEN);
  }

  private toggle = () => {
    if (this.isOpen) {
      this.close();
      this.actions.playUI("uiMenuClose");
    } else {
      this.open();
      this.actions.playUI("uiMenuOpen");
    }
  };

  open() {
    document.documentElement.classList.add(OPEN);
    this.toggleButton.setAttribute("aria-expanded", "true");
    this.list.removeAttribute("inert");
    this.cta.removeAttribute("inert");
    this.tlMenu.timeScale(1).play();
    window.setTimeout(() => document.addEventListener("click", this.onOutside));
  }

  close() {
    if (!this.isOpen) return;
    document.documentElement.classList.remove(OPEN);
    this.toggleButton.setAttribute("aria-expanded", "false");
    this.list.setAttribute("inert", "");
    this.cta.setAttribute("inert", "");
    this.tlMenu.timeScale(1.75).reverse();
    document.removeEventListener("click", this.onOutside);
  }

  dispose() {
    this.tlMenu.kill();
    this.tlBurger.kill();
    this.toggleButton.removeEventListener("click", this.toggle);
    this.toggleButton.removeEventListener("mouseenter", this.onEnter);
    this.toggleButton.removeEventListener("mouseleave", this.onLeave);
    this.menu.removeEventListener("click", this.onMenuClick);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("click", this.onOutside);
    document.documentElement.classList.remove(OPEN);
  }
}

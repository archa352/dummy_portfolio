import TagCloud, { type TagCloud as TagCloudInstance, type TagCloudOptions } from "TagCloud";
import { ease, gsap, isMobile } from "./eases";

const TAGS = ["[      EQualizer      ]", "[      noise control      ]", "[      AI assistant      ]"];

/** Intro rings + rotating tag cloud shown while WebGL assets load. */
export class Loader {
  private circles: HTMLElement[];
  private dots: HTMLElement[];
  private tags: HTMLElement;
  private cloud: TagCloudInstance | null = null;
  private rotation: gsap.core.Timeline | null = null;
  private rotations = 0;
  private canResolve = false;
  private outroRequested = false;
  private outroDone = false;
  private resolveOutro: (() => void) | null = null;
  private onOutroStart: () => void = () => {};

  constructor(root: HTMLElement) {
    this.circles = gsap.utils.toArray<HTMLElement>(".loader__circle", root);
    this.dots = gsap.utils.toArray<HTMLElement>(".loader__dot", root);
    this.tags = root.querySelector<HTMLElement>(".tagcloud-w")!;
    const radius = Math.max(150, (window.innerWidth / 1440) * 400);
    // `direction` is supported by TagCloud but missing from its typings.
    const options: TagCloudOptions & { direction: number } = { radius, maxSpeed: "normal", initSpeed: "fast", direction: 135, keep: false };
    this.cloud = TagCloud(this.tags, TAGS, options);
    gsap.set(this.tags, { scale: 0.8, filter: "blur(1rem)", opacity: 0 });
  }

  intro() {
    document.documentElement.classList.add("is-loading");
    gsap
      .timeline({ defaults: { ease: ease.gentleIn, duration: 1 }, onComplete: () => this.startRotation() })
      .from(this.circles, { scale: 0, stagger: { each: 0.2, from: "start" } })
      .to(this.tags, { scale: 1, filter: "blur(0rem)", opacity: 1 }, "<")
      .to(this.dots, { opacity: 1, stagger: 0.1, duration: 0.5 }, 0);
  }

  private startRotation() {
    if (this.outroDone) return;
    this.rotations = 0;
    this.rotation = gsap.timeline({
      repeat: -1,
      onRepeat: () => {
        this.rotations++;
        if (this.rotations >= 1) this.canResolve = true;
      },
      onUpdate: () => {
        if (this.canResolve && this.outroRequested && !this.outroDone) this.executeOutro();
      },
    });
    this.rotation.to(
      this.circles,
      {
        scale: 1,
        rotationY: "+=360",
        rotationZ: "+=360",
        duration: 3,
        stagger: { each: 0.15, from: "start" },
        ease: ease.custom,
        transformOrigin: "center center",
      },
      "<",
    );
  }

  /** Resolves once the loader has finished at least one full rotation and starts fading out. */
  outro(onStart: () => void) {
    this.onOutroStart = onStart;
    this.outroRequested = true;
    return new Promise<void>((resolve) => {
      this.resolveOutro = resolve;
      if (this.canResolve && !this.outroDone) this.executeOutro();
    });
  }

  private executeOutro() {
    this.outroDone = true;
    gsap
      .timeline({
        defaults: { ease: "expo.out", duration: 0.8 },
        onStart: () => {
          gsap.to(this.tags, { scale: 1.1, filter: "blur(1rem)", opacity: 0 });
          this.onOutroStart();
          this.resolveOutro?.();
        },
        onComplete: () => {
          document.documentElement.classList.remove("is-loading");
          this.cloud?.destroy();
          this.cloud = null;
        },
      })
      .to(this.circles, {
        opacity: 0,
        filter: "blur(1rem)",
        stagger: { amount: 0.8, each: 0.15, from: "start" },
        overwrite: "auto",
        onStart: () => {
          this.rotation?.kill();
          this.rotation = null;
        },
      });
  }

  static indicatorText() {
    return isMobile() ? "[ specs ]" : "[ discover specs ]";
  }

  dispose() {
    this.rotation?.kill();
    this.cloud?.destroy();
  }
}

import { gsap } from "gsap";

// Scroll choreography of the pinned section titles/descriptions. Positions are expressed in
// viewport heights of scroll, reproducing the source ScrollTrigger offsets
// (`top+=N% reference`, scrub: 1) for a 100vh pinned main with 10 viewport heights of scroll.

type Track = { start: number; end: number; timeline: gsap.core.Timeline; smooth: boolean; scrub?: gsap.core.Tween };

const config = [
  { duration: 1, reference: 0.5, titleReference: 0.8, titleDuration: 0.5 },
  { duration: 1.5, reference: 0.65, titleReference: 1, titleDuration: 1 / 1.5 },
  { duration: 3, reference: 1.25, titleReference: 2, titleDuration: 1 },
  { duration: 2, reference: 2, titleReference: 2.5, titleDuration: 1 },
  { duration: 2, reference: 2, titleReference: 2, titleDuration: 1 },
];
const FADE_OUT = 0.5;
export const TOTAL_VIEWPORTS = config.reduce((sum, c) => sum + c.duration, 0) + FADE_OUT;

export class SectionsTimeline {
  private tracks: Track[] = [];
  private titles: HTMLElement[];
  private descs: HTMLElement[];
  private once = false;
  private finalState: "before" | "inside" | "after" = "before";

  constructor(sections: HTMLElement[]) {
    this.titles = sections.map((s) => s.querySelector<HTMLElement>(".section__title")!);
    this.descs = sections.map((s) => s.querySelector<HTMLElement>(".section__desc")!);
    gsap.set(this.descs, { "--progress": 0 });
    gsap.set(sections, { autoAlpha: 1, position: "absolute", top: 0, left: 0 });

    const lastTitle = this.titles[this.titles.length - 1];
    const descsButFirst = this.descs.slice(1);
    let offset = 0;
    sections.forEach((_, i) => {
      if (i === sections.length - 1) return;
      const c = config[i];
      offset += c.duration;
      const title = gsap.timeline({
        paused: true,
        onStart: () => {
          gsap.set(lastTitle, { "--progress": 0, autoAlpha: 1 });
          gsap.set(descsButFirst, { "--progress": 0, autoAlpha: 1 });
        },
      });
      title.to(this.titles[i], { autoAlpha: 0, ease: "none" });
      title.fromTo(this.titles[i + 1], { "--progress": 0 }, { "--progress": 1, ease: "none" }, ">");
      this.add(offset - c.reference, offset + c.titleDuration - c.titleReference, title, true);

      // Exit tweens restore full visibility when scrolling back above their start.
      const descOut = gsap
        .timeline({ paused: true })
        .fromTo(this.descs[i], { "--progress": 1 }, { "--progress": 0, ease: "none", immediateRender: false });
      this.add(offset - c.reference, offset - c.reference, descOut, true);
      const descIn = gsap
        .timeline({ paused: true })
        .fromTo(this.descs[i + 1], { "--progress": 0 }, { "--progress": 1, ease: "none" });
      this.add(offset + 0.2 - c.reference, offset + c.titleDuration - c.titleReference, descIn, true);
    });

    const total = config.reduce((sum, c) => sum + c.duration, 0);
    const fade = gsap.timeline({ paused: true });
    fade.to(lastTitle, { "--progress": 0, duration: FADE_OUT, ease: "none" });
    fade.to(this.descs[this.descs.length - 1], { "--progress": 0, duration: FADE_OUT, ease: "none" }, "<");
    this.add(total - 0.8, total + FADE_OUT - 0.5, fade, false);
  }

  private add(start: number, end: number, timeline: gsap.core.Timeline, smooth: boolean) {
    this.tracks.push({ start, end, timeline, smooth });
  }

  introFirstSection() {
    const tl = gsap.timeline({ defaults: { duration: 2 } });
    tl.to(this.titles[0], { "--progress": 1 });
    tl.to(this.descs[0], { "--progress": 1, autoAlpha: 1 }, "<");
  }

  /** `position` is the scroll offset in viewport heights. */
  update(position: number, immediate = false) {
    for (const track of this.tracks) {
      const span = track.end - track.start;
      const progress = span <= 0 ? (position >= track.start ? 1 : 0) : gsap.utils.clamp(0, 1, (position - track.start) / span);
      if (!track.smooth || immediate) {
        track.scrub?.kill();
        track.timeline.progress(progress);
      } else if (track.timeline.progress() !== progress) {
        track.scrub?.kill();
        track.scrub = gsap.to(track.timeline, { progress, duration: 1, ease: "power3", overwrite: true });
      }
    }
    this.updateFinalFade(position);
  }

  private updateFinalFade(position: number) {
    const total = config.reduce((sum, c) => sum + c.duration, 0);
    const start = total - 0.8;
    const end = total + FADE_OUT - 0.5;
    const state = position < start ? "before" : position > end ? "after" : "inside";
    if (state === this.finalState) return;
    const lastTitle = this.titles[this.titles.length - 1];
    if (state === "after") {
      gsap.set(lastTitle, { "--progress": 0, autoAlpha: 0 });
      gsap.set(this.descs.slice(1), { "--progress": 0, autoAlpha: 0 });
      this.once = true;
    } else if (state === "inside" && this.finalState === "after" && !this.once) {
      gsap.to(lastTitle, { autoAlpha: 1, duration: FADE_OUT, ease: "none" });
    } else if (state === "before") {
      this.once = false;
    }
    this.finalState = state;
  }

  dispose() {
    for (const track of this.tracks) {
      track.scrub?.kill();
      track.timeline.kill();
    }
  }
}

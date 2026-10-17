import Lenis from "lenis";
import { MathUtils } from "three";
import { gsap } from "gsap";
import { GlContext, type AudioName } from "./core";
import { registerShaderChunks } from "./shaderChunks";
import { SectionsTimeline, TOTAL_VIEWPORTS } from "./sections";
import { World } from "./world";

const SNAP_STOPS = [0, 0.125, 0.25, 0.375, 0.5, 0.742, 0.81, 1];
const VELOCITY_THRESHOLD = 50;
const cubicInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export type ExperienceElements = {
  canvas: HTMLElement;
  sections: HTMLElement[];
  projectedPoints: HTMLElement[];
  onProgress: (ratio: number) => void;
};

/** Boots WebGL, smooth scrolling, scroll snapping and the infinite scroll loop. */
export class Experience {
  gl: GlContext;
  world?: World;
  lenis: Lenis;
  sections: SectionsTimeline;
  isIdleScrollAllowed = true;
  private isLooping = false;
  private isBackwardLoopingAllowed = false;
  private isOnEdge = false;
  private velocity = 0;
  private easedVelocity = 0;
  private easedTouchVelocity = 0;
  private snapTimeout = 0;
  private disposed = false;
  private tickerCallback = () => this.tick();

  constructor(private elements: ExperienceElements) {
    registerShaderChunks();
    this.gl = new GlContext(elements.canvas);
    this.lenis = new Lenis({ autoResize: true, syncTouch: true, syncTouchLerp: 0.1, wheelMultiplier: 0.25, duration: 3 });
    this.lenis.scrollTo(0, { immediate: true, force: true });
    this.lenis.stop();
    this.sections = new SectionsTimeline(elements.sections);
    gsap.ticker.add(this.tickerCallback);
    window.addEventListener("wheel", this.onWheel, { passive: true });
    window.addEventListener("resize", this.onResize);
    document.addEventListener("click", this.onDocumentClick);
  }

  async load() {
    await this.gl.load(this.elements.onProgress);
    if (this.disposed) return;
    this.world = new World(this.gl, this.elements.projectedPoints);
    this.lenis.on("scroll", this.onScroll);
  }

  /** Called when the loader hands over to the page. */
  start() {
    this.world?.animateInHomepageScene();
    this.sections.introFirstSection();
    this.lenis.start();
    this.lenis.scrollTo(0, { immediate: true, force: true });
    this.scheduleSnap();
  }

  get progress() {
    return this.lenis.limit > 0 ? this.lenis.scroll / this.lenis.limit : 0;
  }

  playUI(name: AudioName) {
    this.gl.audio.playUI(name);
  }

  scrollToStop(index: number) {
    this.lenis.scrollTo(SNAP_STOPS[index] * this.lenis.limit, { easing: cubicInOut });
  }

  private onScroll = () => {
    const world = this.world;
    if (!world) return;
    const progress = this.progress;
    world.setProgress(progress);
    this.sections.update(progress * TOTAL_VIEWPORTS);
    this.scheduleSnap();
    this.handleLoop(progress);
  };

  private scheduleSnap() {
    window.clearTimeout(this.snapTimeout);
    this.snapTimeout = window.setTimeout(() => {
      if (!this.isIdleScrollAllowed || this.isLooping) return;
      const closest = SNAP_STOPS.reduce((best, stop) => (Math.abs(stop - this.progress) < Math.abs(best - this.progress) ? stop : best));
      this.lenis.scrollTo(closest * this.lenis.limit, { easing: cubicInOut });
    }, 50);
  }

  private handleLoop(progress: number) {
    if (progress > 0.99 && !this.isLooping && this.lenis.direction === 1) {
      void this.loopForward();
      this.isBackwardLoopingAllowed = true;
    }
    if (progress < 0.01) {
      this.isOnEdge = true;
      if (
        !this.isLooping &&
        (this.easedVelocity < -VELOCITY_THRESHOLD || this.easedTouchVelocity < -VELOCITY_THRESHOLD) &&
        this.lenis.direction === -1
      ) {
        void this.loopBackward();
      }
    } else {
      this.isOnEdge = false;
    }
  }

  private async loopForward() {
    const world = this.world;
    if (!world) return;
    this.lenis.stop();
    this.isLooping = true;
    await world.loopForward(() => {
      this.lenis.start();
      this.lenis.scrollTo(0, { immediate: true, force: true, lock: true });
      this.sections.update(0, true);
    });
    this.isLooping = false;
  }

  private async loopBackward() {
    const world = this.world;
    if (!world) return;
    this.isLooping = true;
    await world.loopBackward(() => {
      this.lenis.scrollTo(this.lenis.limit, { immediate: true, force: true, lock: true });
      this.sections.update(TOTAL_VIEWPORTS - 1.5, true);
      this.lenis.stop();
    });
    this.isLooping = false;
    this.lenis.start();
    this.lenis.scrollTo(this.lenis.limit, { immediate: true, force: true, lock: true });
  }

  private onWheel = (event: WheelEvent) => {
    this.velocity = !this.isLooping && this.isOnEdge && this.isBackwardLoopingAllowed ? event.deltaY : 0;
  };

  private onDocumentClick = () => {
    const point = this.elements.projectedPoints.find((p) => p.classList.contains("gl__projected-point--hover"));
    if (!point || !this.world) return;
    const hovered = this.world.active.current.hoveredEarphoneDOM;
    if (hovered === "earphone-r-raycast-volume-up") this.world.pressVolume("up");
    if (hovered === "earphone-r-raycast-volume-down") this.world.pressVolume("down");
  };

  private onResize = () => {
    this.gl.resize();
    this.world?.resize();
  };

  private tick() {
    this.gl.tick();
    const { delta } = this.gl.time;
    this.easedVelocity = MathUtils.damp(this.easedVelocity, this.velocity, 0.025, delta);
    this.velocity = 0;
    const drag = !this.isLooping && this.isOnEdge && this.isBackwardLoopingAllowed ? this.gl.mouse.dragDistance.y : 0;
    this.easedTouchVelocity = MathUtils.damp(this.easedTouchVelocity, drag, 0.025, delta);
    this.lenis.raf(performance.now());
    const world = this.world;
    if (!world) return;
    world.setScrollVelocity(Math.min(this.easedVelocity, this.easedTouchVelocity));
    this.gl.audio.update(delta);
    world.update();
    world.render();
  }

  dispose() {
    this.disposed = true;
    window.clearTimeout(this.snapTimeout);
    gsap.ticker.remove(this.tickerCallback);
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("click", this.onDocumentClick);
    this.lenis.destroy();
    this.sections.dispose();
    this.world?.dispose();
    this.gl.dispose();
  }
}

import { gsap, isMobile } from "./eases";

/** Trailing "[ Click to enable sound ]" label; removed after the first click. */
export class Cursor {
  private label: HTMLElement;
  private mouse = { x: 0, y: 0, lerpedX: 0, lerpedY: 0 };
  private hasMoved = false;
  private clicked = false;
  private raf = 0;
  private tlIn: gsap.core.Timeline;
  private tlOut: gsap.core.Timeline;

  constructor(
    private el: HTMLElement,
    private onFirstInteraction: () => void,
  ) {
    this.label = el.querySelector<HTMLElement>(".cursor__label")!;
    this.tlIn = gsap
      .timeline({ paused: true, defaults: { ease: "none", duration: 0.8 } })
      .fromTo(this.label, { opacity: 0 }, { opacity: 1 })
      .fromTo(
        this.label,
        { text: "" },
        { text: { value: "[&nbsp;&nbsp;&nbsp;Click to enable sound&nbsp;&nbsp;&nbsp;]", speed: 2 } },
        ">",
      );
    this.tlOut = gsap
      .timeline({ paused: true, defaults: { ease: "none", duration: 0.6 }, onComplete: () => this.destroy(true) })
      .to(this.el, { opacity: 0, filter: "blur(1rem)" }, ">");
    if (isMobile()) {
      document.addEventListener("click", this.onClick);
      return;
    }
    document.addEventListener("click", this.onClick);
    window.addEventListener("mousemove", this.onMove);
    this.animate();
  }

  private onClick = () => {
    if (this.clicked) return;
    this.clicked = true;
    this.onFirstInteraction();
    this.tlOut.play();
    document.removeEventListener("click", this.onClick);
  };

  private onMove = (event: MouseEvent) => {
    if (!this.hasMoved) {
      this.hasMoved = true;
      this.el.classList.add("has-moved");
      this.tlIn.play();
    }
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
  };

  private animate = () => {
    this.raf = requestAnimationFrame(this.animate);
    const m = this.mouse;
    m.lerpedX += (m.x - m.lerpedX) * 0.1;
    m.lerpedY += (m.y - m.lerpedY) * 0.1;
    const rotate = (m.x - m.lerpedX) * 0.02;
    this.el.style.transform = `translate3d(${m.lerpedX}px,${m.lerpedY}px,0) rotate(${rotate}deg)`;
  };

  destroy(remove = false) {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("mousemove", this.onMove);
    document.removeEventListener("click", this.onClick);
    if (remove) this.el.style.display = "none";
  }
}

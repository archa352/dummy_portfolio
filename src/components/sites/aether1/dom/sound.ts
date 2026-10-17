import { gsap } from "./eases";

const WAVE = { POINTS: 25, AMPLITUDE_ON: 2.5, LENGTH: 2, SPEED_ON: 0.1, OFFSET: 8 };

/** "Sound" toggle with the animated sine wave icon. */
export class SoundToggle {
  private path: SVGPathElement;
  private wave = { amplitude: 0, targetAmplitude: 0, speed: 0, targetSpeed: 0, time: 0 };
  private playing = false;
  private idleFrames = 0;
  private enabled = false;
  private wasOnBeforeHidden = false;

  constructor(
    private el: HTMLButtonElement,
    private audio: { turnOn: () => void; turnOff: () => void },
  ) {
    this.path = el.querySelector("path")!;
    this.render();
  }

  /** First click anywhere on the page enables sound. */
  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.el.addEventListener("click", this.toggle);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.toggle();
  }

  private toggle = () => {
    const turningOff = this.wave.targetAmplitude > 0;
    if (turningOff) {
      this.el.classList.remove("is-active");
      this.wave.targetAmplitude = 0;
      this.wave.targetSpeed = 0;
      this.el.setAttribute("aria-label", "Mute audio");
      this.el.setAttribute("aria-pressed", "false");
      this.audio.turnOff();
    } else {
      this.el.classList.add("is-active");
      this.wave.targetAmplitude = WAVE.AMPLITUDE_ON;
      this.wave.targetSpeed = WAVE.SPEED_ON;
      this.el.setAttribute("aria-label", "Play audio");
      this.el.setAttribute("aria-pressed", "true");
      this.audio.turnOn();
    }
    this.play();
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.wasOnBeforeHidden = this.wave.targetAmplitude > 0;
      if (this.wasOnBeforeHidden) this.toggle();
    } else if (this.wasOnBeforeHidden && this.wave.targetAmplitude === 0) {
      this.toggle();
    }
  };

  private play() {
    if (this.playing) return;
    this.playing = true;
    this.idleFrames = 0;
    gsap.ticker.add(this.update);
  }

  private render() {
    const points = Array.from({ length: WAVE.POINTS + 1 }, (_, x) => {
      const y = WAVE.OFFSET + this.wave.amplitude * Math.sin((x + this.wave.time) / WAVE.LENGTH);
      return `${x},${y}`;
    });
    this.path.setAttribute("d", `M${points.join(" L")}`);
  }

  private update = () => {
    const w = this.wave;
    w.amplitude += (w.targetAmplitude - w.amplitude) * 0.05;
    w.speed += (w.targetSpeed - w.speed) * 0.05;
    this.render();
    w.time += w.speed;
    if (w.speed < 0.01 && w.amplitude < 0.01 && ++this.idleFrames >= 30) {
      this.playing = false;
      gsap.ticker.remove(this.update);
    }
  };

  dispose() {
    gsap.ticker.remove(this.update);
    this.el.removeEventListener("click", this.toggle);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }
}

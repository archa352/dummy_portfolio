import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { Flip } from "gsap/Flip";
import { TextPlugin } from "gsap/TextPlugin";

gsap.registerPlugin(CustomEase, DrawSVGPlugin, Flip, TextPlugin);

// Named curves from the source animation system.
export const ease = {
  custom: CustomEase.create("custom", "M0,0 C0.61,-0.01 0,1 1,1"),
  customEase: CustomEase.create("customEase", "0.6, 0.01, 0.05, 1"),
  smoothBlur: CustomEase.create("smoothBlur", "0.25, 0.1, 0.25, 1"),
  gentleIn: CustomEase.create("gentleIn", "0.38, 0.005, 0.215, 1.1"),
  instantEase: CustomEase.create("instantEase", "0.1, 0, 0, 1"),
};

export const isMobile = () => /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export { gsap, Flip };

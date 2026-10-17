import { ease, gsap } from "./eases";

/** Looping line-art accents next to the hero and sound descriptions. */
export function animateShapes(root: HTMLElement) {
  const timelines: gsap.core.Timeline[] = [];
  for (const shape of root.querySelectorAll<SVGElement>("[data-shapes]")) {
    const tl = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.2, defaults: { ease: ease.instantEase, duration: 0.8 } });
    if (shape.dataset.shapes === "hero") {
      tl.fromTo(shape.querySelectorAll("g"), { scale: 0, transformOrigin: "0% 50%" }, { scale: 1, stagger: { each: 0.2, from: "center" } });
      tl.fromTo(shape.querySelectorAll("circle"), { scale: 0 }, { scale: 1 }, "<");
    } else if (shape.dataset.shapes === "crafted") {
      const paths = shape.querySelectorAll("path");
      tl.fromTo(shape.querySelectorAll("circle"), { scale: 0, transformOrigin: "50% 50%" }, { scale: 1 }, "<");
      tl.from(paths, { drawSVG: "0% 0%", duration: 1.6 }, "<");
      tl.to(paths, { drawSVG: "100% 100%", duration: 1.6 }, ">");
    }
    timelines.push(tl);
  }
  return () => timelines.forEach((tl) => tl.kill());
}

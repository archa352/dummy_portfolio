import { Color, Mesh, PlaneGeometry, ShaderMaterial, Texture, Uniform, Vector3, type IUniform } from "three";
import { gsap } from "gsap";
import type { GlContext } from "./core";
import { FluidCursor } from "./fluid";
import { MainScene, type SceneHost } from "./mainScene";

const ACTIVE = "gl__projected-point--active";
const HOVER = "gl__projected-point--hover";

/** Composites the active scene (and the previous one during loop transitions) onto the screen. */
export class World {
  isTransitioning = false;
  scrollProgress = 0;
  scenes: { mainA: MainScene; mainB: MainScene };
  active: { current: MainScene; previous: MainScene };
  fluid: FluidCursor;
  private plane: Mesh<PlaneGeometry, ShaderMaterial>;
  private easedCamera;
  private easedFresnel;

  constructor(
    private gl: GlContext,
    private projectedPoints: HTMLElement[],
  ) {
    this.easedCamera = gl.mouse.createEasedNormalized(0.01);
    this.easedFresnel = gl.mouse.createEasedNormalized(0.05);
    this.fluid = new FluidCursor(gl);

    const host: SceneHost = {
      isTransitioning: () => this.isTransitioning,
      scrollProgress: () => this.scrollProgress,
      mouse: { camera: this.easedCamera.value },
      projectedPoints,
      fluidTexture: () => this.fluid.sourceTarget.texture,
      setHoverIntensity: (direction) => this.setHoverIntensity(direction),
      setInteractiveHoverClass: (index) => projectedPoints[index]?.classList.add(HOVER),
      removeInteractiveHoverClasses: () => projectedPoints.forEach((point) => point.classList.remove(HOVER)),
      setBarrel: (strength, distort) => {
        this.u.uBarrelStrength.value = strength;
        this.u.uBarrelDistort.value = distort;
      },
    };
    this.scenes = { mainA: new MainScene(gl, host, "main-a"), mainB: new MainScene(gl, host, "main-b") };
    this.active = { current: this.scenes.mainA, previous: this.scenes.mainB };

    const { sizes } = gl;
    this.plane = new Mesh(
      new PlaneGeometry(1, 1),
      new ShaderMaterial({
        uniforms: {
          tCurrent: new Uniform<Texture | null>(null),
          tPrev: new Uniform<Texture | null>(null),
          tNoise: new Uniform(gl.assets.textures.noise),
          tFluidCursor: new Uniform<Texture | null>(null),
          uOpacity: new Uniform(0),
          uProgress: new Uniform(0),
          uTransition: new Uniform(0),
          uBarrelDistort: new Uniform(0),
          uBarrelStrength: new Uniform(1),
          uAspect: new Uniform(sizes.width / sizes.height),
          uScrollIndicatorCircleRadius: new Uniform(0.72),
          uScrollVelocity: new Uniform(0),
          uHoverIntensity: new Uniform(1),
          COLOR_BLUE: new Uniform(new Color(0xabd7ff)),
          COLOR_LIGHT_BLUE: new Uniform(new Color(0xedf7ff)),
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec2 vUvNormalized;
          uniform float uAspect;
          void main() {
            gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
            vUv = uv;
            vUvNormalized = vec2(uv.x * uAspect, uv.y);
          }
        `,
        fragmentShader: /* glsl */ `
          #include <PI>
          #include <barrelDistort>
          #include <conicGradient>
          varying vec2 vUv;
          varying vec2 vUvNormalized;
          uniform sampler2D tCurrent;
          uniform sampler2D tPrev;
          uniform sampler2D tNoise;
          uniform sampler2D tFluidCursor;
          uniform float uTransition;
          uniform float uBarrelDistort;
          uniform float uBarrelStrength;
          uniform float uAspect;
          uniform float uOpacity;
          uniform float uProgress;
          uniform float uScrollIndicatorCircleRadius;
          uniform float uScrollVelocity;
          uniform float uHoverIntensity;
          uniform vec3 COLOR_LIGHT_BLUE;
          uniform vec3 COLOR_BLUE;
          const float TRANSITION_WIDTH = 0.35;
          const float TRANSITION_DISTORT_STRENGTH = 0.05;
          const float SCROLL_INDICATOR_CIRCLE_THICKNESS = 0.005;
          void main() {
            float textureNoise = texture2D(tNoise, vUvNormalized ).r;
            vec3 fluidCursor = texture2D(tFluidCursor, vUv * 0.95 + 0.025).rgb;
            float distortionMask = min(smoothstep(0.1, 0.2, vUv.x), smoothstep(0.9, 0.8, vUv.x)) * min(smoothstep(0.1, 0.2, vUv.y), smoothstep(0.9, 0.8, vUv.y));
            vec2 uv = vUv;
            uv += fluidCursor.r * 0.025 * uHoverIntensity * distortionMask;
            float barrel = -sin(uBarrelDistort * 3.14) * uBarrelStrength - abs(uScrollVelocity) * 0.015 * textureNoise;
            vec2 distortedUVr = barrelDistort(uv, barrel * 0.25) + fluidCursor.r * 0.01 * uHoverIntensity * distortionMask;
            vec2 distortedUVg = barrelDistort(uv, barrel * 0.3) + fluidCursor.r * 0.02 * uHoverIntensity * distortionMask;
            vec2 distortedUVb = barrelDistort(uv, barrel * 0.35) + fluidCursor.r * 0.03 * uHoverIntensity * distortionMask;
            vec2 uvN = vUv * 2.0 - 1.0;
            vec2 uvNAspect = uvN;
            float progressRotation = PI + (uProgress * PI * 2.0) + (uTransition * PI * 2.0);
            float circleTransition = 0.0;
            float scrollIndicatorDistance = 0.0;
            float scrollIndicatorDot = 0.0;
            if (uAspect > 1.0) {
              uvNAspect = vec2(uvN.x * uAspect, uvN.y);
              circleTransition = length(vec2(uvN.x, uvN.y / uAspect));
            } else {
              uvNAspect = vec2(uvN.x, uvN.y / uAspect);
              circleTransition = length(vec2(uvN.x * uAspect, uvN.y));
            }
            scrollIndicatorDistance = length(uvNAspect);
            scrollIndicatorDot = length(vec2(uvNAspect.x + sin(progressRotation) * uScrollIndicatorCircleRadius, uvNAspect.y + cos(progressRotation) * uScrollIndicatorCircleRadius));
            circleTransition *= 0.5;
            scrollIndicatorDot = pow(smoothstep(0.04, 0.0, scrollIndicatorDot), 2.0);
            scrollIndicatorDot *= 0.5 * smoothstep(0.0, 0.1, uProgress) * smoothstep(1.0, 0.0, uTransition);
            float transitionMask = smoothstep(circleTransition, circleTransition + TRANSITION_WIDTH, uTransition);
            float uvDistort = transitionMask * smoothstep(circleTransition + TRANSITION_WIDTH, circleTransition, uTransition);
            float scrollIndicatorGradient = conicGradient(uvNAspect, uProgress, uTransition) * smoothstep(0.0, 0.1, uProgress);
            float scrollIndicatorMask = smoothstep(0.0, 0.25, scrollIndicatorGradient);
            scrollIndicatorMask *= step(scrollIndicatorDistance, uScrollIndicatorCircleRadius) - step(scrollIndicatorDistance, uScrollIndicatorCircleRadius - SCROLL_INDICATOR_CIRCLE_THICKNESS);
            vec3 scrollIndicatorColor = mix(COLOR_LIGHT_BLUE, COLOR_BLUE, smoothstep(0.0, 0.5, scrollIndicatorGradient));
            float shift = uvDistort * TRANSITION_DISTORT_STRENGTH;
            vec4 textureCurrent = vec4(
              texture(tCurrent, vec2(distortedUVr.x, distortedUVr.y - shift)).r,
              texture(tCurrent, vec2(distortedUVg.x, distortedUVg.y - shift)).g,
              texture(tCurrent, vec2(distortedUVb.x, distortedUVb.y - shift)).b,
              1.0);
            vec4 texturePrev = vec4(
              texture(tPrev, vec2(distortedUVr.x, distortedUVr.y - shift)).r,
              texture(tPrev, vec2(distortedUVg.x, distortedUVg.y - shift)).g,
              texture(tPrev, vec2(distortedUVb.x, distortedUVb.y - shift)).b,
              1.0);
            vec4 diffuse = mix(textureCurrent, texturePrev, transitionMask);
            diffuse.rgb = mix(diffuse.rgb, COLOR_BLUE, fluidCursor.r * 0.25);
            vec3 final = mix(diffuse.rgb, scrollIndicatorColor, scrollIndicatorMask);
            final = mix(final, COLOR_BLUE, scrollIndicatorDot);
            gl_FragColor = vec4(final * uOpacity, 1.0);
            #include <tonemapping_fragment>
          }
        `,
      }),
    );
    this.plane.frustumCulled = false;
    this.plane.matrixAutoUpdate = false;
    gl.screenScene.add(this.plane);

    this.active.current.isRendering = true;
    this.active.current.updateScroll(0);
  }

  get u() {
    return this.plane.material.uniforms as Record<string, IUniform<number>>;
  }

  setProgress(progress: number) {
    this.scrollProgress = progress;
    if (this.isTransitioning) return;
    this.active.current.updateScroll(progress);
    this.u.uProgress.value = progress;
  }

  setScrollVelocity(velocity: number) {
    this.u.uScrollVelocity.value = velocity;
  }

  setHoverIntensity(direction: 1 | -1) {
    gsap.to(this.u.uHoverIntensity, { value: direction === 1 ? 1 : 0, duration: 0.1, ease: "none" });
  }

  pressVolume(button: "up" | "down") {
    this.active.current.pressVolume(button);
    this.gl.audio.setGlobalVolume(button === "up" ? 1 : -1);
  }

  animateInHomepageScene() {
    gsap.fromTo(this.u.uOpacity, { value: 0 }, { value: 1, delay: 1, duration: 0.5, ease: "none" });
    gsap.fromTo(
      this.u.uBarrelDistort,
      { value: 0 },
      {
        value: 1,
        duration: 2.5,
        ease: "power1.out",
        onStart: () => {
          this.u.uBarrelStrength.value = 1;
        },
      },
    );
    const { current, previous } = this.active;
    current.animateIn();
    current.revealCase(1, 1);
    current.waves.triggerWave({ direction: 1, duration: 6, ease: "power1.out" });
    current.particles.triggerWave(1, 4, "back.out(2)", true, 1);
    previous.particles.triggerWave(1, 4, "back.out(2)", true, 1);
  }

  private resetCover(scene: MainScene) {
    const u = scene.materialCover.uniforms;
    u.uColorTransition.value = 0;
    u.uFresnelTransition.value = 0;
    u.uPosition.value = scene.coverChild.getWorldPosition(new Vector3());
    scene.revealCase(1, 1.5);
  }

  private animateCoverIn(scene: MainScene) {
    const u = scene.materialCover.uniforms;
    gsap.fromTo(u.uFresnelTransition, { value: 0 }, { value: 3, duration: 1.5, ease: "power1.inOut", immediateRender: false });
    gsap.fromTo(u.uColorTransition, { value: 0 }, { value: 3, delay: 0.25, duration: 1.5, ease: "power1.inOut", immediateRender: false });
    scene.waves.triggerWave({ direction: 1, duration: 3, ease: "none" });
  }

  /** Circular wipe from the end of the scroll story into a fresh copy of the scene. */
  loopForward(onSwapped: () => void) {
    return new Promise<void>((resolve) => {
      this.isTransitioning = true;
      this.projectedPoints.forEach((point) => point.classList.remove(ACTIVE));
      document.documentElement.classList.add("gl__is-transitioning");
      const from = this.active.current;
      const target = from === this.scenes.mainA ? this.scenes.mainB : this.scenes.mainA;
      this.active.previous = target;
      gsap.fromTo(
        this.u.uTransition,
        { value: 0 },
        {
          value: 1,
          duration: 2,
          ease: "power2.inOut",
          onStart: () => {
            this.gl.audio.animateMuffle(660, 10, 4);
            target.isRendering = true;
            target.updateScroll(0);
            this.resetCover(from);
            this.resetCover(target);
          },
          onComplete: () => {
            onSwapped();
            this.active.current = target;
            window.setTimeout(() => {
              this.u.uTransition.value = 0;
              this.u.uProgress.value = 0;
              window.setTimeout(() => {
                this.active.previous = from;
                from.isRendering = false;
              }, 100);
              document.documentElement.classList.remove("gl__is-transitioning");
              this.isTransitioning = false;
              from.removeActiveProjected();
              target.removeActiveProjected();
              target.updateScroll(0);
              resolve();
            }, 100);
          },
        },
      );
      gsap.fromTo(
        this.u.uBarrelDistort,
        { value: 0 },
        {
          value: 1,
          duration: 2,
          ease: "expo.inOut",
          onStart: () => {
            this.u.uBarrelStrength.value = 1;
          },
        },
      );
      this.animateCoverIn(from);
      this.animateCoverIn(target);
      target.particles.triggerWave(1, 3);
    });
  }

  /** Reverse wipe when scrolling up past the hero: rewinds into the end state of the other scene copy. */
  loopBackward(onJumpToEnd: () => void) {
    return new Promise<void>((resolve) => {
      this.isTransitioning = true;
      this.projectedPoints.forEach((point) => point.classList.remove(ACTIVE));
      this.active.previous.isRendering = true;
      document.documentElement.classList.add("gl__is-transitioning");
      onJumpToEnd();
      this.active.previous = this.active.current;
      window.setTimeout(() => {
        gsap.fromTo(
          this.u.uTransition,
          { value: 1 },
          {
            value: 0,
            duration: 3,
            ease: "expo.inOut",
            onStart: () => {
              this.u.uProgress.value = 1;
              this.active.current = this.active.current === this.scenes.mainA ? this.scenes.mainB : this.scenes.mainA;
              this.active.previous.revealCase(-1);
              this.active.current.isRendering = true;
              this.active.current.updateScroll(1);
              this.active.current.revealCase(-1);
              this.gl.audio.animateMuffle(10, 660, 4);
            },
            onComplete: () => {
              this.active.previous.isRendering = false;
              this.active.current.revealCase(1);
              document.documentElement.classList.remove("gl__is-transitioning");
              this.isTransitioning = false;
              this.active.current.removeActiveProjected();
              resolve();
            },
          },
        );
        gsap.fromTo(
          this.u.uBarrelDistort,
          { value: 1 },
          {
            value: 0,
            duration: 3,
            ease: "expo.inOut",
            onStart: () => {
              this.u.uBarrelStrength.value = 1;
            },
          },
        );
        const covers = [this.active.current, this.active.previous].flatMap((scene) => [
          scene.materialCover.uniforms.uColorTransition,
          scene.materialCover.uniforms.uFresnelTransition,
        ]);
        gsap.fromTo(covers, { value: 3 }, { value: 0, duration: 2, ease: "power1.inOut", immediateRender: false });
        this.active.current.waves.triggerWave({ direction: -1 });
        this.active.previous.waves.triggerWave({ direction: -1 });
        this.active.current.particles.triggerWave(-1);
        this.active.previous.particles.triggerWave(1, 0);
      }, 100);
    });
  }

  resize() {
    this.scenes.mainA.resize();
    this.scenes.mainB.resize();
    this.fluid.resize();
    this.u.uAspect.value = this.gl.sizes.width / this.gl.sizes.height;
  }

  update() {
    this.easedCamera.update(this.gl.time.delta);
    this.easedFresnel.update(this.gl.time.delta);
    this.fluid.update(this.easedFresnel.value);
    const uniforms = this.plane.material.uniforms;
    uniforms.tFluidCursor.value = this.fluid.sourceTarget.texture;
    this.scenes.mainA.update();
    this.scenes.mainB.update();
    uniforms.tCurrent.value = this.active.current.renderTarget.texture;
    uniforms.tPrev.value = this.active.previous.renderTarget.texture;
  }

  render() {
    const renderer = this.gl.renderer;
    for (const scene of [this.scenes.mainA, this.scenes.mainB]) {
      scene.render();
      renderer.clear();
    }
    renderer.setRenderTarget(null);
    renderer.render(this.gl.screenScene, this.gl.screenCamera);
  }

  dispose() {
    this.scenes.mainA.dispose();
    this.scenes.mainB.dispose();
    this.fluid.dispose();
    this.plane.geometry.dispose();
    this.plane.material.dispose();
  }
}


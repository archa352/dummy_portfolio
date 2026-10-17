import {
  AnimationClip,
  AnimationMixer,
  Color,
  Euler,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Intersection,
  type IUniform,
} from "three";
import { gsap } from "gsap";
import type { GlContext } from "./core";
import { Circles, Particles, Waves } from "./effects";
import {
  createBaseMaterial,
  createBloomMaterial,
  createCaseMaterial,
  createCoreMaterial,
  createGlassMaterial,
  createTouchPadMaterial,
  createTubeMaterial,
  type BaseMaterial,
  type CaseMaterial,
  type GlassMaterial,
} from "./materials";

/** What a scene needs from the world that owns it. */
export type SceneHost = {
  isTransitioning: () => boolean;
  scrollProgress: () => number;
  mouse: { camera: Vector2 };
  projectedPoints: HTMLElement[];
  fluidTexture: () => WebGLRenderTarget["texture"];
  setHoverIntensity: (direction: 1 | -1) => void;
  setInteractiveHoverClass: (index: number) => void;
  removeInteractiveHoverClasses: () => void;
  setBarrel: (strength: number, distort: number) => void;
};

type Mixer = { mixer: AnimationMixer; clip: AnimationClip };

const ACTIVE = "gl__projected-point--active";

const byName = <T extends Object3D = Object3D>(root: Object3D, name: string) => {
  const found = root.getObjectByName(name);
  if (!found) throw new Error(`Missing object ${name}`);
  return found as T;
};

export class MainScene {
  scene = new Scene();
  renderTarget: WebGLRenderTarget;
  isRendering = false;
  circles: Circles;
  waves: Waves;
  particles: Particles;
  camera!: PerspectiveCamera;
  materialCover!: CaseMaterial;
  coverChild!: Object3D;
  hoveredEarphoneDOM: string | null = null;
  modelsInitial!: {
    casePositionY: number;
    earphoneLIdle: { position: Vector3; rotation: Euler };
    earphoneRIdle: { position: Vector3; rotation: Euler };
    earphoneVolume: { position: Vector3; rotation: Euler };
  };

  private state = {
    idleIntensity: 0,
    hoverIntensityGlobal: 1,
    hoverCameraIntensity: 0,
    hoverL: { current: 0, target: 0 },
    hoverR: { current: 0, target: 0 },
  };
  private touchPadMouse = { target: new Vector2() };
  private interactivityTargetRotation = new Vector3();
  private hoveredEarphone: string | null = null;
  private previousHoveredEarphone: string | null = null;
  private previousHoveredEarphoneDOM: string | null = null;
  private isHovering = false;
  private previousHover = false;
  private actions!: Object3D;
  private actionsB!: Object3D;
  private previousClasses = { a: -1, b: -1, c: -1, e: -1, f: -1 };
  private actionValues = { a: 0, b: 0, c: 0, e: 0, f: 0, d: 0, fresnel: 0, dof: 0, cameraMobileShift: 0, audio: 0, powerLoop: 0 };
  private raycaster = new Raycaster();
  private mixers: Mixer[] = [];
  private idleTimeline: gsap.core.Timeline;
  private emissiveTimeline: gsap.core.Timeline;
  private hoverTimeline: gsap.core.Timeline;
  private caseTransitionTimeline: gsap.core.Timeline;

  private cameraWrapper!: Object3D;
  private cameraTarget!: Object3D;
  private cameraFov!: Object3D;
  private caseModel!: Object3D;
  private tube!: Mesh;
  private coverTop!: Object3D;
  private earphoneLIdle!: Object3D;
  private earphoneRIdle!: Object3D;
  private earphoneLRaycast!: Mesh;
  private earphoneRRaycast!: Mesh;
  private earphoneRInteractivity!: Object3D;
  private earphoneCoreL!: Object3D;
  private earphoneCoreLBloom!: Mesh<PlaneGeometry, ShaderMaterial>;
  private earphoneRVolume!: Object3D;
  private earphoneTouchPad!: Mesh<PlaneGeometry, ShaderMaterial>;
  private raycastTargets!: Record<"mic" | "speaker" | "volumeUp" | "volumeDown", { mesh: Mesh; child: Object3D }>;
  private projectedEmpties: Object3D[] = [];
  private materialGlassL!: GlassMaterial;
  private materialGlassR!: GlassMaterial;
  private materialBaseL!: BaseMaterial;
  private materialBaseR!: BaseMaterial;
  private materialCore!: ShaderMaterial;
  private tubeMaterial = createTubeMaterial();

  constructor(
    private gl: GlContext,
    private host: SceneHost,
    public id: string,
  ) {
    const { sizes } = gl;
    this.scene.background = new Color(0x133153);
    this.renderTarget = new WebGLRenderTarget(sizes.width * sizes.pixelRatio, sizes.height * sizes.pixelRatio, { samples: 1 });
    this.circles = new Circles(gl);
    this.scene.add(this.circles.instances);
    this.waves = new Waves(gl);
    this.scene.add(this.waves.instance);
    this.particles = new Particles(gl);
    this.scene.add(this.particles.instance);

    this.setMaterials();
    this.setCamera();
    this.setModels();
    this.setLights();
    this.updateCameraAspect();

    this.idleTimeline = gsap.timeline({ paused: true });
    this.idleTimeline.fromTo(this.state, { idleIntensity: 0 }, { idleIntensity: 1, ease: "power2.inOut", duration: 0.5 });
    this.idleTimeline.fromTo(this.state, { idleIntensity: 1 }, { idleIntensity: 0, ease: "power2.inOut", duration: 1, immediateRender: false }, 4);

    const emissive = [this.materialGlassL.uniforms.uEmissiveTransition, this.materialGlassR.uniforms.uEmissiveTransition];
    this.emissiveTimeline = gsap.timeline({ paused: true });
    this.emissiveTimeline.fromTo(emissive, { value: 0 }, { value: 1, ease: "expo.inOut", duration: 1 }, 0.9);
    this.emissiveTimeline.fromTo(emissive, { value: 1 }, { value: 0, ease: "expo.inOut", duration: 0.5, immediateRender: false }, 5);

    this.hoverTimeline = gsap.timeline({ paused: true });
    this.hoverTimeline.fromTo(this.state, { hoverIntensityGlobal: 1 }, { hoverIntensityGlobal: 0 });

    const cover = [this.materialCover.uniforms.uFresnelTransition, this.materialCover.uniforms.uColorTransition];
    this.caseTransitionTimeline = gsap.timeline({ paused: true });
    this.caseTransitionTimeline.fromTo(cover, { value: 3 }, { value: 0, delay: 1, duration: 0.1, immediateRender: false });
    this.caseTransitionTimeline.fromTo(cover, { value: 0 }, { value: 0, duration: 1, immediateRender: false });
  }

  private setMaterials() {
    const { assets } = this.gl;
    const t = assets.textures;
    this.materialCover = createCaseMaterial(assets, {
      map: t.case.bottomDiffuse,
      aoMap: t.case.alphaAo,
      metalness: 0.75,
      roughness: 0,
      alphaMap: t.case.alphaAo,
      emissiveMap: t.case.emissive,
      emissiveIntensity: 1,
      emissive: 0xffffff,
    });
    const glass = {
      metalness: 1,
      roughness: 0,
      emissive: 0xffffff,
      emissiveMap: t.headphones.emissive,
      emissiveIntensity: 1.25,
      normalMap: t.headphones.normal,
    };
    this.materialGlassL = createGlassMaterial(assets, glass);
    this.materialGlassR = createGlassMaterial(assets, glass);
    const base = {
      map: t.earphoneSilicone,
      aoMap: t.headphones.roughnessAo,
      aoMapIntensity: 1.1,
      roughnessMap: t.headphones.roughnessAo,
      emissive: 0xffffff,
      emissiveMap: t.headphones.emissive,
      emissiveIntensity: 1,
    };
    this.materialBaseL = createBaseMaterial(assets, base);
    this.materialBaseR = createBaseMaterial(assets, base);
    this.materialCore = createCoreMaterial(assets);
  }

  private createMixer(target: Object3D, name: string): Mixer {
    const mixer = new AnimationMixer(target);
    const clip = AnimationClip.findByName(this.gl.assets.scene.animations, name);
    if (!clip) throw new Error(`Missing animation ${name}`);
    mixer.clipAction(clip).play();
    this.mixers.push({ mixer, clip });
    return { mixer, clip };
  }

  private setCamera() {
    const source = this.gl.assets.scene.scene;
    this.cameraWrapper = byName(source, "camera-wrapper").clone();
    this.scene.add(this.cameraWrapper);
    this.camera = this.cameraWrapper.children[0].clone() as PerspectiveCamera;
    this.cameraWrapper.add(this.camera);
    this.createMixer(this.cameraWrapper, "animation.camera");
    this.cameraTarget = byName(source, "target").clone();
    this.createMixer(this.cameraTarget, "animation.target.camera");
    this.cameraFov = byName(source, "fov").clone();
    this.createMixer(this.cameraFov, "animation.camera.fov");
    this.scene.add(this.cameraFov);
  }

  private setModels() {
    const source = this.gl.assets.scene.scene;
    this.caseModel = byName(source, "case").clone();
    this.scene.add(this.caseModel);
    const find = <T extends Object3D = Object3D>(name: string) => byName<T>(this.caseModel, name);

    this.tube = byName<Mesh>(source, "tube").clone();
    this.tube.material = this.tubeMaterial;
    this.tube.rotation.x = Math.PI * 0.075;
    this.tube.renderOrder = 0;
    this.scene.add(this.tube);

    this.coverTop = find("case-top");
    (this.coverTop as Mesh).material = this.materialCover.material;
    this.coverTop.renderOrder = 1;
    const coverBottom = find<Mesh>("case-bottom");
    coverBottom.material = this.materialCover.material;
    coverBottom.renderOrder = 1;
    this.coverChild = find("case-child");
    this.createMixer(this.coverChild, "animation.case.child");
    this.materialCover.uniforms.uPosition.value = this.coverChild.getWorldPosition(new Vector3());

    this.createMixer(find("earphone-l"), "animation.earphone.l");
    this.earphoneLRaycast = find<Mesh>("earphone-l-raycast");
    this.earphoneLRaycast.visible = false;
    find<Mesh>("earphone-l-base").material = this.materialBaseL.material;
    find<Mesh>("earphone-l-glass").material = this.materialGlassL.material;
    this.earphoneLIdle = find("earphone-l-idle");

    const silicone = find<Mesh>("earphone-l-silicone");
    this.createMixer(silicone, "animation.earphone.silicone");
    silicone.material = this.materialBaseL.material;

    this.earphoneCoreL = find("earphone-l-core");
    this.createMixer(this.earphoneCoreL, "animation.earphone.core");
    (this.earphoneCoreL as Mesh).material = this.materialCore;
    this.earphoneCoreLBloom = new Mesh(new PlaneGeometry(1, 1), createBloomMaterial(this.gl.assets));
    this.earphoneCoreL.add(this.earphoneCoreLBloom);

    find<Mesh>("earphone-l-rectangle").material = this.materialBaseL.material;
    const speaker = find<Mesh>("earphone-l-speaker");
    this.createMixer(speaker, "animation.earphone.speaker");
    speaker.material = this.materialBaseR.material;

    this.createMixer(find("earphone-r"), "animation.earphone.r");
    this.earphoneRRaycast = find<Mesh>("earphone-r-raycast");
    this.earphoneRRaycast.visible = false;

    const raycastChild = (name: string) => {
      const mesh = find<Mesh>(name);
      mesh.visible = false;
      mesh.material = new MeshBasicMaterial({ wireframe: true });
      const child = new Group();
      mesh.add(child);
      return { mesh, child };
    };
    this.raycastTargets = {
      speaker: raycastChild("earphone-r-raycast-speaker"),
      volumeUp: raycastChild("earphone-r-raycast-volume-up"),
      volumeDown: raycastChild("earphone-r-raycast-volume-down"),
      mic: raycastChild("earphone-r-raycast-mic"),
    };

    this.earphoneRInteractivity = find("earphone-r-interactivity");
    find<Mesh>("earphone-r-base").material = this.materialBaseR.material;
    find<Mesh>("earphone-r-glass").material = this.materialGlassR.material;
    this.earphoneRIdle = find("earphone-r-idle");
    find<Mesh>("earphone-r-core").material = this.materialCore;
    this.earphoneRVolume = find("earphone-r-volume");
    (this.earphoneRVolume as Mesh).material = this.materialBaseR.material;
    this.earphoneTouchPad = find<Mesh<PlaneGeometry, ShaderMaterial>>("earphone-r-touch-pad");
    this.earphoneTouchPad.material = createTouchPadMaterial(this.gl.assets);

    this.actions = byName(source, "actions");
    this.createMixer(this.actions, "animation.actions");
    this.actionsB = byName(source, "actions-b");
    this.createMixer(this.actionsB, "animation.actions-b");

    this.projectedEmpties = [
      "projection-spectrum-visualiser",
      "projection-ipx",
      "projection-heart-rate",
      "projection-mic-hd",
      "projection-mic",
      "projection-touch-pad",
      "projection-volume",
      "projection-chip",
      "projection-dampening-shell",
      "projection-diffusion-rotaty-discs",
      "projection-emission-core",
    ].map((name) => find(name));

    this.modelsInitial = {
      casePositionY: this.caseModel.position.y,
      earphoneLIdle: { position: this.earphoneLIdle.position.clone(), rotation: this.earphoneLIdle.rotation.clone() },
      earphoneRIdle: { position: this.earphoneRIdle.position.clone(), rotation: this.earphoneRIdle.rotation.clone() },
      earphoneVolume: { position: this.earphoneRVolume.position.clone(), rotation: this.earphoneRVolume.rotation.clone() },
    };
  }

  private setLights() {
    const lightCamera = byName<PointLight>(this.gl.assets.scene.scene, "light-camera").clone();
    this.createMixer(lightCamera, "animation.light.camera");
    lightCamera.scale.set(1, 1, 1);
    lightCamera.intensity = 2000;
    lightCamera.decay = 2;
    this.scene.add(lightCamera);
    const lightEarphoneL = byName<PointLight>(this.caseModel, "light-earphone-l");
    lightEarphoneL.scale.set(1, 1, 1);
    lightEarphoneL.intensity = 100;
    lightEarphoneL.decay = 10;
  }

  get projectionNames() {
    return this.projectedEmpties.map((empty) => empty.name);
  }

  animateIn() {
    gsap.fromTo(
      this.caseModel.position,
      { y: this.modelsInitial.casePositionY + 3 },
      { y: this.modelsInitial.casePositionY, ease: "back.out(2)", duration: 0.5, delay: 1.15 },
    );
    gsap.fromTo(this.camera.position, { y: -10 }, { y: 0, ease: "expo.out", duration: 1, delay: 1.15 });
  }

  revealCase(direction: 1 | -1, delay = 0, duration = 1) {
    const open = -Math.PI * 0.475;
    gsap.fromTo(
      this.coverTop.rotation,
      { y: direction === 1 ? 0 : open },
      { y: direction === 1 ? open : 0, duration, delay, ease: "expo.inOut" },
    );
  }

  private triggerHover() {
    const tl = gsap.timeline();
    tl.to(this.caseModel.position, { y: this.modelsInitial.casePositionY - 0.4, duration: 0.25, ease: "power2.inOut" });
    tl.to(this.caseModel.position, { y: this.modelsInitial.casePositionY, duration: 0.5, ease: "power2.inOut", immediateRender: false });
  }

  updateCameraAspect() {
    this.camera.aspect = this.gl.sizes.width / this.gl.sizes.height;
    this.camera.updateProjectionMatrix();
  }

  private toggleProjected(indices: number[], active: boolean) {
    for (const index of indices) this.host.projectedPoints[index]?.classList.toggle(ACTIVE, active);
  }

  removeActiveProjected() {
    this.previousClasses = { a: -1, b: -1, c: -1, e: -1, f: -1 };
  }

  updateScroll(progress: number) {
    for (const { mixer, clip } of this.mixers) mixer.setTime(progress * clip.duration * 0.9999);
    this.idleTimeline.progress(progress);
    this.emissiveTimeline.progress(progress);
    this.hoverTimeline.progress(Math.max(Math.min((-0.01 + progress) * 100, 1), 0));
    this.caseTransitionTimeline.progress(progress);
    this.camera.fov = 2 * Math.atan(21.25 / (2 * this.cameraFov.position.x)) * (180 / Math.PI);
    this.camera.updateProjectionMatrix();

    const a = this.actions;
    const b = this.actionsB;
    const v = this.actionValues;
    v.a = Math.ceil(Math.abs(a.position.y));
    v.b = Math.ceil(Math.abs(a.position.z));
    v.c = Math.ceil(Math.abs(a.position.x));
    v.e = Math.ceil(Math.abs(b.scale.x));
    v.f = Math.ceil(Math.abs(b.scale.z));
    v.d = Math.abs(a.scale.x);
    v.fresnel = Math.abs(a.scale.z);
    v.dof = Math.abs(a.scale.y);
    v.cameraMobileShift = Math.abs(b.position.y);
    v.audio = Math.abs(b.position.z);
    v.powerLoop = Math.abs(b.scale.y);
    const classes = {
      a: Math.floor(Math.abs(a.position.y)),
      b: Math.floor(Math.abs(a.position.z)),
      c: Math.floor(Math.abs(a.position.x)),
      e: Math.floor(Math.abs(b.scale.x)),
      f: Math.floor(Math.abs(b.scale.z)),
    };

    if (this.isRendering && !this.host.isTransitioning()) {
      const p = this.previousClasses;
      if (classes.a !== p.a) this.toggleProjected([0, 1], classes.a > 0);
      if (classes.b !== p.b) this.toggleProjected([2, 3], classes.b > 0);
      if (classes.c !== p.c) {
        this.toggleProjected([4, 5, 6], classes.c > 0);
        if (!classes.c) {
          this.triggerSpeakerHover(-1);
          this.triggerVolumeHover(-1);
        }
      }
      if (classes.e !== p.e) this.toggleProjected([7, 9], classes.e > 0);
      if (classes.f !== p.f) this.toggleProjected([8, 10], classes.f > 0);
      this.previousClasses = classes;
    }

    for (const material of [this.materialGlassL, this.materialGlassR, this.materialBaseL, this.materialBaseR]) {
      material.uniforms.uFresnelTransition.value = v.fresnel;
    }
    this.particles.uniforms.uBokeh.value = v.dof * 0.9;
    this.particles.uniforms.uCloseUpBokeh.value = Math.abs(a.position.x);
    (this.tubeMaterial.uniforms.uBokeh as IUniform<number>).value = v.dof * 0.075;
    (this.earphoneCoreLBloom.material.uniforms.uOpacity as IUniform<number>).value = v.d;
  }

  private get mobile() {
    return this.gl.sizes.width < 768;
  }

  private updateCamera() {
    this.camera.filmOffset = this.mobile && this.actionValues.cameraMobileShift > 0 ? this.actionValues.cameraMobileShift : 0;
    this.camera.lookAt(this.cameraTarget.position);
    if (!this.mobile) {
      const mouse = this.host.mouse.camera;
      this.camera.position.x = -mouse.x;
      this.camera.position.z = mouse.y;
      this.camera.rotation.x += mouse.y * 0.05;
      this.camera.rotation.y -= mouse.x * 0.05;
      this.camera.rotation.z = -mouse.y * mouse.x * 0.25;
    } else {
      this.camera.rotation.z = 0;
    }
  }

  private updateInteractivity() {
    const target = this.interactivityTargetRotation;
    const rotation = this.earphoneRInteractivity.rotation;
    const current = new Vector3(rotation.x, rotation.y, rotation.z);
    if (this.actions.position.x > 0 || current.length() > 0.01 || target.length() > 0.01) {
      const { delta } = this.gl.time;
      rotation.x = MathUtils.damp(rotation.x, target.x, 0.01, delta);
      rotation.y = MathUtils.damp(rotation.y, target.y, 0.01, delta);
      rotation.z = MathUtils.damp(rotation.z, target.z, 0.01, delta);
    }
  }

  private updateIdle() {
    const { hoverL, hoverR, hoverIntensityGlobal, idleIntensity } = this.state;
    const l = this.modelsInitial.earphoneLIdle.position.y;
    const r = this.modelsInitial.earphoneRIdle.position.y;
    this.earphoneLIdle.position.y = hoverL.current > 0 ? MathUtils.lerp(l, l + 1.05, hoverL.current * hoverIntensityGlobal) : l;
    this.earphoneRIdle.position.y = hoverR.current > 0 ? MathUtils.lerp(r, r + 1.05, hoverR.current * hoverIntensityGlobal) : r;
    if (idleIntensity > 0) {
      const elapsed = this.gl.time.elapsed;
      this.earphoneLIdle.position.y += Math.sin(10 + elapsed) * 0.05 * idleIntensity;
      this.earphoneRIdle.position.y += Math.sin(elapsed * 0.75) * 0.05 * idleIntensity;
    }
  }

  private updateProjectedPoints() {
    if (this.host.isTransitioning()) return;
    const v = this.actionValues;
    const groups: [number, number[]][] = [
      [v.a, [0, 1]],
      [v.b, [2, 3]],
      [v.c, [4, 5, 6]],
      [v.e, [7, 9]],
      [v.f, [8, 10]],
    ];
    const world = new Vector3();
    const { width, height } = this.gl.sizes;
    for (const [active, indices] of groups) {
      if (!active) continue;
      for (const index of indices) {
        const dom = this.host.projectedPoints[index];
        if (!dom) continue;
        this.projectedEmpties[index].getWorldPosition(world);
        world.project(this.camera);
        dom.style.transform = `translate(${world.x * (width / 2)}px, ${-world.y * (height / 2)}px)`;
      }
    }
  }

  private updateHover() {
    if (!this.gl.mouse.isMouseMoved) return;
    const s = this.state;
    const { delta } = this.gl.time;
    this.raycaster.setFromCamera(this.gl.mouse.normalized.current, this.camera);

    if (this.host.scrollProgress() < 0.1 && !this.host.isTransitioning()) {
      const hits = this.raycaster.intersectObjects([this.earphoneLRaycast, this.earphoneRRaycast]);
      this.isHovering = hits.length > 0;
      if (hits[0]?.object.name === "earphone-l-raycast") this.hoveredEarphone = "earphone-l";
      if (hits[0]?.object.name === "earphone-r-raycast") this.hoveredEarphone = "earphone-r";

      if (this.isHovering !== this.previousHover) {
        if (this.isHovering) this.host.setHoverIntensity(-1);
        else {
          this.host.setHoverIntensity(1);
          this.hoveredEarphone = null;
          if (!this.waves.isAnimating && (s.hoverL.current > 0.75 || s.hoverR.current > 0.75) && s.hoverIntensityGlobal) {
            this.triggerHover();
            this.particles.triggerHover();
            this.waves.triggerWave({ direction: 1, duration: 1.75, intensity: 0.5, lightIntensity: 0, ease: "power1.out" });
          }
        }
      }
      if (this.hoveredEarphone !== this.previousHoveredEarphone) {
        const strength = this.waves.isAnimating ? 0.25 : 1;
        s.hoverL.target = this.hoveredEarphone === "earphone-l" ? strength : 0;
        s.hoverR.target = this.hoveredEarphone === "earphone-r" ? strength : 0;
      }
      for (const hover of [s.hoverL, s.hoverR]) {
        if (hover.target > 0.01 || hover.current > 0.01) hover.current = MathUtils.damp(hover.current, hover.target, 0.05, delta);
      }
      const strongest = Math.max(s.hoverL.current, s.hoverR.current);
      if (strongest > 0.01) s.hoverCameraIntensity = MathUtils.damp(s.hoverCameraIntensity, strongest * s.hoverIntensityGlobal, 0.05, delta);

      this.materialGlassL.uniforms.uEmissiveHover.value = s.hoverL.current * s.hoverIntensityGlobal;
      this.materialGlassR.uniforms.uEmissiveHover.value = s.hoverR.current * s.hoverIntensityGlobal;
      const tilt = (idle: Object3D, initial: Euler, amount: number, sign: 1 | -1) => {
        idle.rotation.x = MathUtils.lerp(initial.x, initial.x + (sign * Math.PI) / 20, amount);
        idle.rotation.y = MathUtils.lerp(initial.y, initial.y + Math.PI / 20, amount);
        idle.rotation.z = MathUtils.lerp(initial.z, initial.z + (sign * Math.PI) / 12, amount);
      };
      if (s.hoverL.current > 0.01) tilt(this.earphoneLIdle, this.modelsInitial.earphoneLIdle.rotation, s.hoverL.current * s.hoverIntensityGlobal, 1);
      if (s.hoverR.current > 0.01) tilt(this.earphoneRIdle, this.modelsInitial.earphoneRIdle.rotation, s.hoverR.current * s.hoverIntensityGlobal, -1);

      if (s.hoverCameraIntensity > 0.01 && !this.host.isTransitioning()) {
        this.host.setBarrel(0.25, MathUtils.lerp(0, 0.5, s.hoverCameraIntensity));
        const scale = MathUtils.lerp(1, 0.9, s.hoverCameraIntensity);
        this.particles.instance.scale.set(scale, scale, 1);
        this.camera.zoom = MathUtils.lerp(1, 1.05, s.hoverCameraIntensity);
        this.camera.updateProjectionMatrix();
        const synth = this.gl.audio.tracks?.synthLoop;
        if (synth) synth.highpass.frequency.setValueAtTime(10 + s.hoverCameraIntensity * 650, synth.context.currentTime);
        this.waves.globalSpeed = 1 - s.hoverCameraIntensity;
        this.particles.globalSpeed = 1 - s.hoverCameraIntensity;
      }
    }

    if (this.actionValues.fresnel) {
      const texture = this.host.fluidTexture();
      for (const material of [this.materialGlassL, this.materialGlassR, this.materialBaseL, this.materialBaseR]) {
        material.uniforms.tFluidCursor.value = texture;
      }
    }

    const padUniforms = this.earphoneTouchPad.material.uniforms as Record<string, IUniform>;
    if (Math.floor(Math.abs(this.actions.position.x))) {
      const t = this.raycastTargets;
      const hits: Intersection[] = this.raycaster.intersectObjects([t.mic.mesh, t.speaker.mesh, t.volumeUp.mesh, t.volumeDown.mesh, this.earphoneTouchPad]);
      if (hits.length > 0) {
        const name = hits[0].object.name;
        const strength = this.actions.position.x;
        const aim = (child: Object3D, adjust: (o: Object3D) => void, factor: number, label: string) => {
          child.lookAt(this.cameraWrapper.position);
          adjust(child);
          this.interactivityTargetRotation.set(child.rotation.x, child.rotation.y, child.rotation.z).multiplyScalar(factor * strength);
          this.hoveredEarphoneDOM = label;
        };
        if (name === "earphone-r-raycast-volume-up")
          aim(t.volumeUp.child, (o) => (o.rotateY(-Math.PI * 0.5), o.rotateX(Math.PI * 0.5)), 0.35, name);
        if (name === "earphone-r-raycast-volume-down")
          aim(t.volumeDown.child, (o) => (o.rotateY(-Math.PI * 0.5), o.rotateX(Math.PI * 0.5)), 0.35, name);
        if (name === "earphone-r-raycast-speaker") aim(t.speaker.child, (o) => o.rotateX(Math.PI * 0.5), 0.75, name);
        if (name === "earphone-r-raycast-mic") aim(t.mic.child, (o) => o.rotateZ(-Math.PI * 0.5), 0.5, name);
        const pad = hits[0].object.name === "earphone-r-touch-pad" ? hits[0] : hits[1]?.object.name === "earphone-r-touch-pad" ? hits[1] : null;
        if (pad) this.touchPadMouse.target.copy(hits[1]?.uv ?? hits[0].uv ?? this.touchPadMouse.target);
      } else {
        this.hoveredEarphoneDOM = null;
        this.touchPadMouse.target.set(0, 0);
        this.interactivityTargetRotation.set(0, 0, 0);
      }
      const mouseUv = padUniforms.uMouseUv.value as Vector2;
      mouseUv.x = MathUtils.damp(mouseUv.x, this.touchPadMouse.target.x, 0.05, delta);
      mouseUv.y = MathUtils.damp(mouseUv.y, this.touchPadMouse.target.y, 0.05, delta);
      padUniforms.uFrequency.value = this.gl.audio.synthFrequency * 0.05;
    } else {
      this.interactivityTargetRotation.set(0, 0, 0);
    }

    if (this.hoveredEarphoneDOM !== this.previousHoveredEarphoneDOM) {
      if (this.hoveredEarphoneDOM) {
        switch (this.hoveredEarphoneDOM) {
          case "earphone-r-raycast-mic":
            this.host.setInteractiveHoverClass(4);
            this.triggerVolumeHover(-1);
            this.triggerSpeakerHover(-1);
            break;
          case "earphone-r-raycast-speaker":
            this.host.setInteractiveHoverClass(5);
            this.triggerVolumeHover(-1);
            this.triggerSpeakerHover(1);
            break;
          case "earphone-r-raycast-volume-up":
            this.host.setInteractiveHoverClass(6);
            this.triggerVolumeHover(1, "up");
            this.triggerSpeakerHover(-1);
            break;
          case "earphone-r-raycast-volume-down":
            this.host.setInteractiveHoverClass(6);
            this.triggerVolumeHover(1, "down");
            this.triggerSpeakerHover(-1);
            break;
        }
        this.host.setHoverIntensity(-1);
      } else {
        this.host.removeInteractiveHoverClasses();
        this.host.setHoverIntensity(1);
        this.triggerVolumeHover(-1);
        this.triggerSpeakerHover(-1);
      }
    }
    this.previousHover = this.isHovering;
    this.previousHoveredEarphone = this.hoveredEarphone;
    this.previousHoveredEarphoneDOM = this.hoveredEarphoneDOM;
  }

  triggerVolumeHover(direction: 1 | -1, button?: "up" | "down") {
    const u = this.materialBaseR.uniforms;
    const initial = this.modelsInitial.earphoneVolume;
    const quick = { duration: 0.15, ease: "none" };
    if (direction === 1) {
      gsap.to(this.earphoneRVolume.rotation, { z: initial.rotation.z + (button === "up" ? 0.015 : -0.015), ...quick });
      gsap.to(this.earphoneRVolume.position, { x: initial.position.x - 0.0025, ...quick });
      gsap.to(u.uVolumeUpHover, { value: button === "up" ? 1 : 0, ...quick });
      gsap.to(u.uVolumeDownHover, { value: button === "up" ? 0 : 1, ...quick });
      gsap.to(u.uVolumeShadowUp, { value: button === "up" ? 0.05 : 0, ...quick });
      gsap.to(u.uVolumeShadowDown, { value: button === "up" ? 0 : 0.05, ...quick });
    } else {
      gsap.to(this.earphoneRVolume.rotation, { z: initial.rotation.z, ...quick });
      gsap.to(this.earphoneRVolume.position, { x: initial.position.x, ...quick });
      for (const uniform of [u.uVolumeUpHover, u.uVolumeDownHover, u.uVolumeShadowUp, u.uVolumeShadowDown]) gsap.to(uniform, { value: 0, ...quick });
    }
  }

  pressVolume(button: "up" | "down") {
    const u = this.materialBaseR.uniforms;
    const initial = this.modelsInitial.earphoneVolume;
    gsap.to(button === "up" ? u.uVolumeShadowUp : u.uVolumeShadowDown, { value: 0.25, duration: 0.1, ease: "none" });
    gsap.to(this.earphoneRVolume.rotation, {
      z: initial.rotation.z + (button === "up" ? 0.035 : -0.035),
      duration: 0.1,
      ease: "none",
      onComplete: () => this.triggerVolumeHover(1, button),
    });
    gsap.to(this.earphoneRVolume.position, { x: initial.position.x - 0.01, duration: 0.1, ease: "none" });
  }

  private triggerSpeakerHover(direction: 1 | -1) {
    gsap.to(this.earphoneTouchPad.material.uniforms.uReveal, { value: direction === 1 ? 1 : 0, duration: 1.25, ease: "power1.inOut" });
  }

  private updateAudio() {
    const tracks = this.gl.audio.tracks;
    if (!tracks) return;
    if (this.actionValues.audio > 0 && this.host.scrollProgress() > 0.5 && !this.host.isTransitioning()) {
      tracks.synthLoop.highpass.frequency.setValueAtTime(10 + this.actionValues.audio * 650, tracks.synthLoop.context.currentTime);
    }
    if (this.actionValues.powerLoop > 0) tracks.powerLoop.setVolume(this.actionValues.powerLoop * this.gl.audio.defaultVolumes.powerLoop);
  }

  render() {
    if (!this.isRendering) return;
    this.gl.renderer.setRenderTarget(this.renderTarget);
    this.gl.renderer.render(this.scene, this.camera);
  }

  update() {
    if (!this.isRendering) return;
    this.updateCamera();
    this.updateHover();
    this.updateInteractivity();
    this.updateIdle();
    this.tube.rotation.y = -this.gl.time.elapsed * 0.15;
    this.updateProjectedPoints();
    if (this.actionValues.d > 0) {
      this.earphoneCoreLBloom.lookAt(this.cameraWrapper.position);
      this.earphoneCoreLBloom.rotateZ(-Math.PI * 0.125);
      this.earphoneCoreL.lookAt(this.cameraWrapper.position);
      this.earphoneCoreL.rotateZ(-Math.PI * 0.125);
    }
    const elapsed = this.gl.time.elapsed;
    (this.materialCore.uniforms.uTime as IUniform<number>).value = elapsed;
    (this.earphoneCoreLBloom.material.uniforms.uTime as IUniform<number>).value = elapsed;
    (this.earphoneTouchPad.material.uniforms.uTime as IUniform<number>).value = elapsed * 0.1;
    this.updateAudio();
    this.circles.update();
    this.waves.update();
    this.particles.update();
  }

  resize() {
    const { sizes } = this.gl;
    this.particles.resize();
    this.circles.resize();
    this.renderTarget.setSize(sizes.width * sizes.pixelRatio, sizes.height * sizes.pixelRatio);
    this.updateCameraAspect();
  }

  dispose() {
    this.renderTarget.dispose();
    this.idleTimeline.kill();
    this.emissiveTimeline.kill();
    this.hoverTimeline.kill();
    this.caseTransitionTimeline.kill();
  }
}


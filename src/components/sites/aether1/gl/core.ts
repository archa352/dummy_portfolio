import {
  Audio,
  AudioListener,
  AudioLoader,
  Camera,
  Clock,
  MathUtils,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  Texture,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { gsap } from "gsap";

export const ASSET_PATH = "/sites/aether1";

export type Sizes = { width: number; height: number; pixelRatio: number; aspect: number };

function readSizes(): Sizes {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return { width, height, pixelRatio: Math.min(window.devicePixelRatio, 1.5), aspect: width / height };
}

export type EasedVector = { value: Vector2; update: (delta: number) => void };

export class Mouse {
  isMouseMoved = false;
  isMouseHolding = false;
  normalized = { current: new Vector2() };
  dragStart = new Vector2();
  dragDistance = new Vector2();
  private pointer = new Vector2();
  private eased: EasedVector[] = [];

  constructor(private sizes: Sizes) {
    window.addEventListener("mousemove", this.onMove);
    window.addEventListener("touchmove", this.onTouchMove, { passive: true });
    window.addEventListener("mousedown", this.onDown);
    window.addEventListener("touchstart", this.onTouchStart, { passive: true });
    window.addEventListener("mouseup", this.onUp);
    window.addEventListener("touchend", this.onUp);
  }

  private setPointer(x: number, y: number) {
    this.isMouseMoved = true;
    this.pointer.set(x, y);
    this.normalized.current.set((x / this.sizes.width) * 2 - 1, -(y / this.sizes.height) * 2 + 1);
    if (this.isMouseHolding) this.dragDistance.set(x - this.dragStart.x, y - this.dragStart.y);
  }

  private onMove = (event: MouseEvent) => this.setPointer(event.clientX, event.clientY);
  private onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (touch) this.setPointer(touch.clientX, touch.clientY);
  };
  private onDown = (event: MouseEvent) => {
    this.isMouseHolding = true;
    this.dragStart.set(event.clientX, event.clientY);
  };
  private onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    this.isMouseHolding = true;
    this.dragStart.set(touch.clientX, touch.clientY);
  };
  private onUp = () => {
    this.isMouseHolding = false;
    this.dragDistance.set(0, 0);
  };

  createEasedNormalized(lambda: number): EasedVector {
    const eased: EasedVector = {
      value: new Vector2(),
      update: (delta: number) => {
        eased.value.x = MathUtils.damp(eased.value.x, this.normalized.current.x, lambda, delta);
        eased.value.y = MathUtils.damp(eased.value.y, this.normalized.current.y, lambda, delta);
      },
    };
    this.eased.push(eased);
    return eased;
  }

  resize(sizes: Sizes) {
    this.sizes = sizes;
  }

  dispose() {
    window.removeEventListener("mousemove", this.onMove);
    window.removeEventListener("touchmove", this.onTouchMove);
    window.removeEventListener("mousedown", this.onDown);
    window.removeEventListener("touchstart", this.onTouchStart);
    window.removeEventListener("mouseup", this.onUp);
    window.removeEventListener("touchend", this.onUp);
  }
}

export type FilteredAudio = Audio<GainNode> & { highpass: BiquadFilterNode };

export type AetherAssets = {
  scene: GLTF;
  textures: {
    noise: Texture;
    bloom: Texture;
    earphoneSilicone: Texture;
    matcapGlass: Texture;
    case: { alphaAo: Texture; emissive: Texture; matcapMask: Texture; bottomDiffuse: Texture };
    headphones: {
      alpha: Texture;
      emissive: Texture;
      emissiveMask: Texture;
      volumeShadowMask: Texture;
      roughnessAo: Texture;
      normal: Texture;
    };
  };
  audio: Record<AudioName, FilteredAudio>;
};

export type AudioName =
  | "uiQuestionSend"
  | "uiReply"
  | "uiMenuClose"
  | "uiAskAetherOpen"
  | "uiMenuOpen"
  | "synthLoop"
  | "powerLoop";

const audioFiles: Record<AudioName, string> = {
  uiQuestionSend: "AETHER_2.5_UI_question-send-03.mp3",
  uiReply: "AETHER_2.5_UI_reply-03.mp3",
  uiMenuClose: "AETHER_2.5_UI_menu-close-03.mp3",
  uiAskAetherOpen: "AETHER_2.5_UI_ask-aether-open-03.mp3",
  uiMenuOpen: "AETHER_2.5_UI_menu-open-03.mp3",
  synthLoop: "AETHER_2.5_synthloop-03.mp3",
  powerLoop: "AETHER_2.5_powerloop-02.mp3",
};

const textureFiles = {
  noise: "noise-r.png",
  caseAlphaAo: "case-alpha-ao-03.webp",
  caseEmissive: "case-emissive-16.webp",
  caseMatcapMask: "case-matcap-mask-01.webp",
  caseBottomDiffuse: "case-bottom-diffuse-08.webp",
  headphoneAlpha: "headphone-alpha-05.webp",
  headphoneEmissive: "headphone-emissive-11.webp",
  headphoneEmissiveMask: "headphone-emissive-mask-06.webp",
  headphoneVolumeShadow: "headphone-volume-shadow-03.webp",
  headphoneRoughnessAo: "headphone-roughness-ao-03.webp",
  headphoneNormal: "headphone-normal-10.webp",
  bloom: "bloom-12.webp",
  earphoneSilicone: "headphone-silicone-19.webp",
  matcapGlass: "matcap-glass-01.png",
} as const;

type TextureKey = keyof typeof textureFiles;

// Texture color spaces mirror the source loader: masks are tagged sRGB, the case diffuse linear.
const textureColorSpace: Partial<Record<TextureKey, string>> = {
  caseAlphaAo: SRGBColorSpace,
  caseEmissive: SRGBColorSpace,
  caseMatcapMask: SRGBColorSpace,
  caseBottomDiffuse: "srgb-linear",
  headphoneAlpha: SRGBColorSpace,
  headphoneEmissive: SRGBColorSpace,
  headphoneEmissiveMask: SRGBColorSpace,
  headphoneVolumeShadow: SRGBColorSpace,
  headphoneRoughnessAo: SRGBColorSpace,
  bloom: SRGBColorSpace,
  matcapGlass: SRGBColorSpace,
};

export async function loadAssets(listener: AudioListener, onProgress: (ratio: number) => void): Promise<AetherAssets> {
  const draco = new DRACOLoader();
  draco.setDecoderPath(`${ASSET_PATH}/draco/`);
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(draco);
  const textureLoader = new TextureLoader();
  const audioLoader = new AudioLoader();

  const total = 1 + Object.keys(textureFiles).length + Object.keys(audioFiles).length;
  let done = 0;
  const tick = () => {
    done++;
    onProgress(done / total);
  };

  const scenePromise = gltfLoader.loadAsync(`${ASSET_PATH}/models/scene-258.glb`).then((gltf) => {
    tick();
    return gltf;
  });

  const textureEntries = await Promise.all(
    (Object.keys(textureFiles) as TextureKey[]).map(async (key) => {
      const texture = await textureLoader.loadAsync(`${ASSET_PATH}/textures/${textureFiles[key]}`);
      if (key === "noise") {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
      } else {
        texture.flipY = false;
        texture.colorSpace = textureColorSpace[key] ?? NoColorSpace;
      }
      tick();
      return [key, texture] as const;
    }),
  );
  const t = Object.fromEntries(textureEntries) as Record<TextureKey, Texture>;

  const audioEntries = await Promise.all(
    (Object.keys(audioFiles) as AudioName[]).map(async (name) => {
      const buffer = await audioLoader.loadAsync(`${ASSET_PATH}/audio/${audioFiles[name]}`);
      const audio = new Audio(listener) as FilteredAudio;
      const filter = audio.context.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(10, audio.context.currentTime);
      audio.setBuffer(buffer);
      audio.setFilter(filter);
      audio.setVolume(1);
      audio.highpass = filter;
      tick();
      return [name, audio] as const;
    }),
  );

  const scene = await scenePromise;
  draco.dispose();

  return {
    scene,
    textures: {
      noise: t.noise,
      bloom: t.bloom,
      earphoneSilicone: t.earphoneSilicone,
      matcapGlass: t.matcapGlass,
      case: {
        alphaAo: t.caseAlphaAo,
        emissive: t.caseEmissive,
        matcapMask: t.caseMatcapMask,
        bottomDiffuse: t.caseBottomDiffuse,
      },
      headphones: {
        alpha: t.headphoneAlpha,
        emissive: t.headphoneEmissive,
        emissiveMask: t.headphoneEmissiveMask,
        volumeShadowMask: t.headphoneVolumeShadow,
        roughnessAo: t.headphoneRoughnessAo,
        normal: t.headphoneNormal,
      },
    },
    audio: Object.fromEntries(audioEntries) as Record<AudioName, FilteredAudio>,
  };
}

const defaultVolumes: Record<AudioName, number> = {
  synthLoop: 1,
  powerLoop: 0.46,
  uiAskAetherOpen: 1,
  uiMenuClose: 0.55,
  uiMenuOpen: 0.55,
  uiQuestionSend: 1,
  uiReply: 0.8,
};

export class AudioManager {
  defaultVolumes = defaultVolumes;
  globalVolume = { max: 0.2, current: 0.2, target: 0.2 };
  synthFrequency = 0;
  private analyser: AnalyserNode | null = null;
  private analyserData: Uint8Array<ArrayBuffer> | null = null;
  private audio: Record<AudioName, FilteredAudio> | null = null;

  constructor(public listener: AudioListener) {}

  attach(audio: Record<AudioName, FilteredAudio>) {
    this.audio = audio;
    const synth = audio.synthLoop;
    this.analyser = synth.context.createAnalyser();
    this.analyser.fftSize = 32;
    synth.getOutput().connect(this.analyser);
    this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);
  }

  get tracks() {
    return this.audio;
  }

  animateAudioIn() {
    const audio = this.audio;
    if (!audio) return;
    if (audio.synthLoop.context.state === "suspended") void audio.synthLoop.context.resume();
    if (!audio.synthLoop.isPlaying) {
      audio.synthLoop.setLoop(true);
      audio.synthLoop.play();
    }
    if (!audio.powerLoop.isPlaying) {
      audio.powerLoop.setLoop(true);
      audio.powerLoop.play();
    }
    audio.powerLoop.setVolume(0);
    const state = { volume: 0 };
    gsap.to(state, {
      volume: 1,
      duration: 1,
      ease: "power2.inOut",
      onUpdate: () => audio.synthLoop.setVolume(state.volume * this.defaultVolumes.synthLoop),
    });
  }

  toggleGlobalVolume(value: number) {
    gsap.to(this.globalVolume, {
      current: value,
      duration: 0.4,
      ease: "none",
      onUpdate: () => this.listener.setMasterVolume(this.globalVolume.current),
    });
  }

  setGlobalVolume(direction: number) {
    this.globalVolume.target = Math.max(0, Math.min(this.globalVolume.max, this.globalVolume.target + direction * 0.025));
    gsap.to(this.globalVolume, {
      current: this.globalVolume.target,
      duration: 0.2,
      ease: "none",
      onUpdate: () => this.listener.setMasterVolume(this.globalVolume.current),
    });
  }

  animateMuffle(from: number, to: number, duration: number) {
    const audio = this.audio;
    if (!audio) return;
    const state = { muffled: from };
    gsap.to(state, {
      muffled: to,
      duration,
      ease: "none",
      onUpdate: () => audio.synthLoop.highpass.frequency.setValueAtTime(state.muffled, audio.synthLoop.context.currentTime),
    });
  }

  playUI(name: AudioName) {
    const track = this.audio?.[name];
    if (!track || track.context.state !== "running") return;
    if (track.isPlaying) track.stop();
    track.play();
    track.setVolume(this.defaultVolumes[name]);
  }

  update(delta: number) {
    if (!this.analyser || !this.analyserData) return;
    this.analyser.getByteFrequencyData(this.analyserData);
    this.synthFrequency = MathUtils.damp(this.synthFrequency, this.analyserData[5] ?? 0, 0.0025, delta);
  }
}

export class GlContext {
  sizes: Sizes = readSizes();
  renderer: WebGLRenderer;
  screenScene = new Scene();
  screenCamera = new Camera();
  mouse: Mouse;
  listener = new AudioListener();
  audio = new AudioManager(this.listener);
  time = { delta: 0, elapsed: 0 };
  assets!: AetherAssets;
  private clock = new Clock();

  constructor(public container: HTMLElement) {
    this.renderer = new WebGLRenderer({ powerPreference: "high-performance", precision: "lowp" });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(this.sizes.pixelRatio);
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    container.appendChild(this.renderer.domElement);
    this.mouse = new Mouse(this.sizes);
    this.screenCamera.add(this.listener);
    this.listener.setMasterVolume(this.audio.globalVolume.current);
  }

  async load(onProgress: (ratio: number) => void) {
    this.assets = await loadAssets(this.listener, onProgress);
    this.audio.attach(this.assets.audio);
  }

  tick() {
    // The source scales delta to "hundredths of a second", capped at 30fps.
    this.time.delta = Math.min(this.clock.getDelta(), 1 / 30) * 100;
    this.time.elapsed = this.clock.getElapsedTime();
  }

  resize() {
    this.sizes = readSizes();
    this.mouse.resize(this.sizes);
    this.renderer.setPixelRatio(this.sizes.pixelRatio);
    this.renderer.setSize(this.sizes.width, this.sizes.height);
  }

  dispose() {
    this.mouse.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    for (const track of Object.values(this.assets?.audio ?? {})) if (track.isPlaying) track.stop();
  }
}

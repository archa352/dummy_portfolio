import {
  BufferAttribute,
  BufferGeometry,
  Color,
  EllipseCurve,
  Group,
  MathUtils,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Sphere,
  Texture,
  TorusGeometry,
  Uniform,
  Vector2,
  Vector3,
  type IUniform,
} from "three";
import { GPUComputationRenderer, type Variable } from "three/addons/misc/GPUComputationRenderer.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { gsap } from "gsap";
import type { GlContext } from "./core";

/** Six dashed elliptical orbits circling the product. */
export class Circles {
  instances = new Group();
  private curve = new EllipseCurve(0, 0, 1, 1, 0, 2 * Math.PI, false, 0);
  private points = this.curve.getPoints(100);
  private material: LineMaterial;
  private uniforms = {
    uOffset: new Uniform(0.35),
    uDashSize: new Uniform(0.175),
    uFadeSize: new Uniform(0.05),
    uLineLength: new Uniform(this.curve.getLength()),
    uTime: new Uniform(0),
    COLOR_HIGHLIGHT: new Uniform(new Color(0xffffff)),
    COLOR_DASH: new Uniform(new Color(0x41a5ff)),
  };

  constructor(private gl: GlContext) {
    this.material = new LineMaterial({ linewidth: 2, dashed: true, premultipliedAlpha: true, transparent: true });
    this.material.resolution.set(gl.sizes.width, gl.sizes.height);
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aRandom;\nvarying float vRandom;")
        .replace("#include <fog_vertex>", "#include <fog_vertex>\nvRandom = aRandom;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "uniform float linewidth;",
          /* glsl */ `
          varying float vRandom;
          uniform float linewidth;
          uniform float uOffset;
          uniform float uLineLength;
          uniform float uDashSize;
          uniform float uFadeSize;
          uniform float uTime;
          uniform vec3 COLOR_HIGHLIGHT;
          uniform vec3 COLOR_DASH;
        `,
        )
        .replace("if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX", "")
        .replace(
          "gl_FragColor = vec4( diffuseColor.rgb, alpha );",
          /* glsl */ `
          float offset = fract(uOffset - uTime + vRandom);
          float dash = smoothstep(fract(0.0 + uFadeSize + uDashSize + offset), fract(0.0 + uDashSize + offset), vLineDistance / uLineLength) - smoothstep(fract(0.0 + uFadeSize + offset), fract(0.0 + offset), vLineDistance / uLineLength);
          float highlight = pow(dash, 2.0);
          float cutMask = 1.0 - distance(vLineDistance / uLineLength, 0.5) * 2.0;
          gl_FragColor = vec4(COLOR_DASH + highlight * 0.25, dash * alpha * cutMask);
        `,
        );
    };

    for (let i = 0; i < 6; i++) {
      const line = new Line2(this.createGeometry(), this.material);
      line.computeLineDistances();
      line.rotation.set((Math.random() * 2 - 1) * 0.1, 0, (Math.random() * 2 - 1) * 0.1 + Math.PI);
      line.scale.setScalar(1 + i * 0.05);
      this.instances.add(line);
    }
    this.instances.rotation.set(MathUtils.degToRad(13) - Math.PI * 0.5, MathUtils.degToRad(15), MathUtils.degToRad(-32));
    this.instances.position.set(-5.86, 10, -2.9);
    this.instances.scale.set(16.37, 12.62, 16.37);
  }

  private createGeometry() {
    const geometry = new LineGeometry();
    geometry.setFromPoints(this.points);
    const count = geometry.attributes.position.count;
    const random = new Float32Array(count).fill(Math.random() * 0.2);
    geometry.setAttribute("aRandom", new BufferAttribute(random, 1));
    return geometry;
  }

  resize() {
    this.material.resolution.set(this.gl.sizes.width, this.gl.sizes.height);
  }

  update() {
    this.uniforms.uTime.value = this.gl.time.elapsed * 0.5;
  }
}

const wavesVertex = (lightWidth: string, withNoise: boolean) => /* glsl */ `
  #include <orthogonal>
  varying vec2 vUv;
  varying vec2 vUvn;
  varying vec3 vNormal;
  varying float vLight;
  varying float vTransitionLight;
  varying float vTransitionMask;
  varying float vWave;
  varying float vBigWave;
  uniform float uTime;
  uniform float uWaveTransition;
  uniform float uIntensity;
  uniform float uFrequency;
  uniform vec3 uLightDirection;
  uniform sampler2D tNoise;
  const float TRANSITION_SIZE = 2.;
  const float WAVE_STRENGTH = 6.;
  const float LIGHT_WIDTH = ${lightWidth};
  #include <getSmallWave>
  #include <getBigWave>
  void main() {
    vec2 uvN = uv * 2.0 - 1.0;
    ${
      withNoise
        ? /* glsl */ `
    float textureNoise = 1.0 - texture2D(tNoise, uvN * 2.0).r * 2.0;
    vec3 center = position;
    vec3 neighbourX = position + vec3(0.01, 0.0, 0.0);
    vec3 neighbourY = position + vec3(0.0, -0.01, 0.0);
    float bigWave = getBigWave(position) * uIntensity;
    center.z += getSmallWaves(position, textureNoise) + bigWave;
    neighbourX.z += getSmallWaves(neighbourX, textureNoise) + getBigWave(neighbourX) * uIntensity;
    neighbourY.z += getSmallWaves(neighbourY, textureNoise) + getBigWave(neighbourY) * uIntensity;
    vec3 dx = neighbourX - center;
    vec3 dy = neighbourY - center;
    float localPosition = length(position) * 0.5;
    float transitionMask = length(position.x + position.y * 0.25);
    float transitionLight = max(1.0 - distance(localPosition, smoothstep(0.2, 1.0, uWaveTransition) * 5.5) * (LIGHT_WIDTH + (1.0 - smoothstep(0.2, 1.0, uWaveTransition))), 0.0);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(center, 1.0);
    vTransitionMask = transitionMask;
    vNormal = 1.0 - normalize(cross(dx, dy));
    vUv = uv;
    vUvn = uvN;
    vLight = max(dot(vNormal, uLightDirection), 0.0);
    vTransitionLight = transitionLight;
    vWave = center.z;
    vBigWave = bigWave;`
        : /* glsl */ `
    vec3 center = position;
    center.z += getSmallWaves(position, 0.0) + getBigWave(position) * uIntensity;
    float localPosition = length(position) * 0.5;
    float transitionMask = length(position.x + position.y * 0.25);
    float transitionLight = max(1.0 - distance(localPosition, smoothstep(0.2, 1.0, uWaveTransition) * 5.5) * (1.0 + (LIGHT_WIDTH - smoothstep(0.2, 1.0, uWaveTransition))), 0.0);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(center, 1.0);
    vTransitionMask = transitionMask;
    vUv = uv;
    vTransitionLight = transitionLight;
    vWave = center.z;`
    }
  }
`;

export type WaveOptions = {
  direction?: 1 | -1;
  duration?: number;
  ease?: string;
  delay?: number;
  intensity?: number;
  lightIntensity?: number;
};

/** Rippling ground plane plus the wireframe light sweep used for intro and loop transitions. */
export class Waves {
  instance = new Group();
  isAnimating = false;
  globalSpeed = 1;
  material: ShaderMaterial;

  constructor(private gl: GlContext) {
    this.material = new ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: new Uniform(0),
        uWaveTransition: new Uniform(0),
        uLightIntensity: new Uniform(1),
        uIntensity: new Uniform(1),
        uFrequency: new Uniform(1),
        uLightDirection: new Uniform(new Vector3(3, 3, -1)),
        tNoise: new Uniform(gl.assets.textures.noise),
        COLOR_BASE: new Uniform(new Color(0x133153)),
        COLOR_HIGHLIGHT: new Uniform(new Color(0x32526f)),
        COLOR_LIGHT: new Uniform(new Color(0x60b2ff)),
      },
      vertexShader: wavesVertex("2.0", true),
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec2 vUvn;
        varying vec3 vNormal;
        varying float vLight;
        varying float vTransitionLight;
        varying float vTransitionMask;
        varying float vWave;
        varying float vBigWave;
        uniform float uWaveTransition;
        uniform float uLightIntensity;
        uniform vec3 COLOR_BASE;
        uniform vec3 COLOR_HIGHLIGHT;
        uniform vec3 COLOR_LIGHT;
        void main() {
          float alpha = smoothstep(1.0, 0.5, length(vUvn));
          float centerShadow = smoothstep(0.0, 0.5, length(vUvn));
          float vignette = smoothstep(0.25, 0.75, length(vUvn));
          vec3 color = mix(COLOR_BASE, COLOR_HIGHLIGHT, vLight);
          color += vec3(0.5, 0.75, 1.0) * pow((1.0 - distance(vUv, vec2(0.85, 1.0))) * 4.0, 4.0) * 0.01;
          color *= min(pow(distance(vUv, vec2(0.0)) * 1.5, 6.0), 1.0);
          color *= centerShadow;
          color = mix(color, COLOR_BASE, vignette);
          color *= clamp(vLight * 0.3, 0.0, 1.0);
          color *= 1.0 - clamp(vBigWave, 0.0, 1.0) * 0.25;
          color = mix(color, COLOR_LIGHT, vTransitionLight * smoothstep(1.0, 0.75, uWaveTransition) * smoothstep(0.0, 0.05, uWaveTransition) * uLightIntensity);
          color += smoothstep(0.5, 1.0,vTransitionLight) * 1.25 * smoothstep(1.0, 0.75, uWaveTransition) * smoothstep(0.0, 0.05, uWaveTransition) * smoothstep(3.0, 6., vTransitionMask) * uLightIntensity;
          color = min(color, 0.65);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
    const mesh = new Mesh(new PlaneGeometry(30, 30, 256, 256), this.material);
    mesh.rotation.x = -Math.PI * 0.425;
    mesh.position.set(0.114, -2.18, -1.98);
    mesh.renderOrder = 1;
    this.instance.add(mesh);

    const wireframeMaterial = new ShaderMaterial({
      transparent: true,
      wireframe: true,
      depthTest: false,
      uniforms: this.material.uniforms,
      vertexShader: wavesVertex("1.0", false),
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying float vTransitionLight;
        uniform float uWaveTransition;
        uniform float uLightIntensity;
        uniform vec3 COLOR_LIGHT;
        void main() {
          gl_FragColor = vec4(COLOR_LIGHT * 1.75, vTransitionLight * sin(smoothstep(0.4, 0.75, uWaveTransition) * 3.14) * uLightIntensity);
          gl_FragColor.rgb = min(gl_FragColor.rgb, 0.65);
        }
      `,
    });
    const wireframe = new Mesh(new PlaneGeometry(30, 30, 54, 54), wireframeMaterial);
    wireframe.rotation.copy(mesh.rotation);
    wireframe.position.copy(mesh.position);
    wireframe.renderOrder = 2;
    this.instance.add(wireframe);
  }

  private get u() {
    return this.material.uniforms as Record<string, IUniform<number>>;
  }

  triggerWave(options: WaveOptions = {}) {
    const { direction = 1, duration = 4.25, ease = "power2.inOut", delay = 0, intensity = 1, lightIntensity = 1 } = options;
    this.u.uLightIntensity.value = lightIntensity;
    this.u.uIntensity.value = intensity;
    if (direction === 1) {
      gsap.fromTo(
        this.u.uWaveTransition,
        { value: 0 },
        {
          value: 1,
          delay,
          duration,
          ease,
          onStart: () => {
            this.isAnimating = true;
          },
          onUpdate: () => {
            this.u.uTime.value += Math.sin(this.u.uWaveTransition.value * Math.PI) * this.gl.time.delta * 0.075;
          },
          onComplete: () => {
            this.isAnimating = false;
          },
        },
      );
    } else {
      gsap.fromTo(
        this.u.uWaveTransition,
        { value: 1 },
        {
          value: 0,
          duration: 2.75,
          ease: "expo.inOut",
          onStart: () => {
            this.isAnimating = true;
          },
          onComplete: () => {
            this.isAnimating = false;
          },
        },
      );
    }
  }

  update() {
    const frequency = this.gl.audio.synthFrequency * 0.005;
    const { delta } = this.gl.time;
    this.u.uTime.value += (0.25 + this.globalSpeed * 0.75) * delta * 0.01;
    this.u.uTime.value += frequency * delta * 0.5;
    this.u.uFrequency.value = frequency;
  }
}

const particlesCompute = /* glsl */ `
  #include <simplex>
  uniform float uTime;
  uniform float uTransition;
  uniform float uDeltaTime;
  uniform float uFrequency;
  uniform sampler2D uBasePositions;
  const float FLOWFIELD_SIZE = .25;
  const float FLOWFIELD_STRENGTH = 5.;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 particleTexture = texture2D(uParticles, uv);
    vec4 basePositionTexture = texture2D(uBasePositions, uv);
    if (particleTexture.a >= 1.0) {
      particleTexture.a = fract(particleTexture.a);
      particleTexture.xyz = basePositionTexture.xyz;
    } else {
      vec3 flowField = vec3(
        simplexNoise4d(vec4(particleTexture.xyz * FLOWFIELD_SIZE + 0.0, uTime * 0.25)),
        simplexNoise4d(vec4(particleTexture.xyz * FLOWFIELD_SIZE + 1.0, uTime * 0.25)),
        simplexNoise4d(vec4(particleTexture.xyz * FLOWFIELD_SIZE + 2.0, uTime * 0.25))
      );
      flowField = normalize(flowField);
      particleTexture.xyz += flowField * (FLOWFIELD_STRENGTH + (1.0 - uTransition) * 10.) * uDeltaTime;
      particleTexture.a += uDeltaTime;
    }
    gl_FragColor = mix(particleTexture, basePositionTexture, pow(uFrequency * 15., 3.0));
  }
`;

/** Flow-field dust particles spawned around a torus, simulated on the GPU. */
export class Particles {
  instance = new Group();
  globalSpeed = 1;
  mesh: Points;
  material: ShaderMaterial;
  private computation: GPUComputationRenderer;
  private variable: Variable;

  constructor(private gl: GlContext) {
    const scale = 0.25;
    const base = new TorusGeometry(5, scale, 48, 48);
    const count = base.attributes.position.count;
    const size = Math.ceil(Math.sqrt(count));
    this.computation = new GPUComputationRenderer(size, size, gl.renderer);
    const baseTexture = this.computation.createTexture();
    const data = baseTexture.image.data as Float32Array;
    const positions = base.attributes.position.array;
    for (let i = 0; i < count; i++) {
      data[i * 4 + 0] = positions[i * 3 + 0] + (2 * Math.random() - 1) * scale;
      data[i * 4 + 1] = positions[i * 3 + 1] + (2 * Math.random() - 1) * scale;
      data[i * 4 + 2] = positions[i * 3 + 2] + (2 * Math.random() - 1) * scale;
      data[i * 4 + 3] = Math.random();
    }
    this.variable = this.computation.addVariable("uParticles", particlesCompute, baseTexture);
    this.computation.setVariableDependencies(this.variable, [this.variable]);
    const computeUniforms = this.variable.material.uniforms;
    computeUniforms.uTime = new Uniform(0);
    computeUniforms.uDeltaTime = new Uniform(0);
    computeUniforms.uBasePositions = new Uniform(baseTexture);
    computeUniforms.uTransition = new Uniform(0);
    computeUniforms.uFrequency = new Uniform(0);
    this.computation.init();

    const uvs = new Float32Array(count * 2);
    const random = new Float32Array(count);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (i >= count) continue;
        uvs[i * 2 + 0] = (x + 0.5) / size;
        uvs[i * 2 + 1] = (y + 0.5) / size;
        random[i] = Math.random();
      }
    }
    const geometry = new BufferGeometry();
    geometry.setDrawRange(0, count);
    geometry.setAttribute("aParticlesUv", new BufferAttribute(uvs, 2));
    geometry.setAttribute("aRandom", new BufferAttribute(random, 1));
    geometry.boundingSphere = new Sphere(new Vector3(), 10);
    base.dispose();

    this.material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSize: new Uniform(0.115),
        uResolution: new Uniform(new Vector2(gl.sizes.width * gl.sizes.pixelRatio, gl.sizes.height * gl.sizes.pixelRatio)),
        uParticlesTexture: new Uniform<Texture | null>(null),
        uProgress: new Uniform(1),
        uTransition: new Uniform(0),
        uCircleSize: new Uniform(0.025),
        uBokeh: new Uniform(0),
        uFocusDistance: new Uniform(7.5),
        uFocusRange: new Uniform(0.25),
        uCloseUpBokeh: new Uniform(0),
        COLOR_HIGHLIGHT: new Uniform(new Color(0xb2e0ff)),
      },
      vertexShader: /* glsl */ `
        uniform vec2 uResolution;
        uniform float uSize;
        uniform sampler2D uParticlesTexture;
        uniform float uProgress;
        uniform float uTransition;
        uniform float uFocusDistance;
        uniform float uFocusRange;
        uniform float uCloseUpBokeh;
        attribute vec2 aParticlesUv;
        attribute float aRandom;
        varying float vLifeSize;
        varying float vDepth;
        void main() {
          vec4 particle = texture2D(uParticlesTexture, aParticlesUv);
          particle.z += 15.0 * smoothstep(0.9, 1.0, aRandom) * smoothstep(0.0, 0.3, uProgress);
          vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
          vec4 viewPosition = viewMatrix * modelPosition;
          gl_Position = projectionMatrix * viewPosition;
          float lifeIn = smoothstep(0.0, 0.1, particle.a);
          float lifeOut = 1.0 - smoothstep(0.9, 1.0, particle.a);
          float lifeSize = min(lifeIn, lifeOut) * smoothstep(0.2, 1.0, uTransition);
          gl_PointSize = aRandom * lifeSize * uSize * uResolution.y;
          vLifeSize = lifeSize;
          vDepth = pow(min(abs((uFocusDistance + viewPosition.z - uCloseUpBokeh * 5.0) * uFocusRange), 1.0), 2.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLifeSize;
        varying float vDepth;
        uniform float uCircleSize;
        uniform float uBokeh;
        uniform vec3 COLOR_HIGHLIGHT;
        void main() {
          float distanceToCenter = length(gl_PointCoord - 0.5);
          if(distanceToCenter > 0.5) discard;
          float mask = 1.0 - distance(distanceToCenter, 0.25 / 8.0) * 8.0;
          mask = smoothstep(1.0 - uCircleSize - pow(uBokeh, 2.0) * 8.0 * vDepth, 1.0, mask);
          vec4 color = vec4(COLOR_HIGHLIGHT, max(mask, 0.25 * step(distanceToCenter, 0.25 / 8.0)) * vLifeSize);
          color.a -= (pow(uBokeh, 0.5) * (0.75 + vDepth * 0.25));
          color.a = max(color.a, 0.0);
          gl_FragColor = color;
        }
      `,
    });
    this.mesh = new Points(geometry, this.material);
    this.mesh.rotation.x = -Math.PI * 0.425;
    this.mesh.position.set(0.114, 1.82, -0.48);
    this.mesh.renderOrder = 2;
    this.instance.add(this.mesh);
  }

  get uniforms() {
    return this.material.uniforms as Record<string, IUniform<number>>;
  }

  triggerHover() {
    const tl = gsap.timeline({ delay: 0.5 });
    tl.fromTo(this.mesh.scale, { x: 1, y: 1, z: 1 }, { x: 1.15, y: 1.15, z: 1.15, duration: 0.5, ease: "power2.inOut" });
    tl.fromTo(
      this.mesh.scale,
      { x: 1.15, y: 1.15, z: 1.15 },
      { x: 1, y: 1, z: 1, duration: 2, ease: "power2.inOut", immediateRender: false },
    );
  }

  triggerWave(direction: 1 | -1, duration?: number, ease?: string, withCompute = false, delay = 0) {
    const computeTransition = this.variable.material.uniforms.uTransition as IUniform<number>;
    if (direction === 1) {
      const d = duration ?? 4.1;
      const e = ease ?? "power2.inOut";
      gsap.fromTo(this.mesh.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, delay, duration: d, ease: e });
      gsap.fromTo(this.uniforms.uTransition, { value: 0 }, { value: 1, duration: d, ease: e });
      if (withCompute) gsap.fromTo(computeTransition, { value: 0 }, { value: 1, duration: d, ease: e });
    } else {
      const d = duration ?? 2.75;
      gsap.fromTo(this.mesh.scale, { x: 1, y: 1, z: 1 }, { x: 0.1, y: 0.1, z: 0.1, duration: d, ease: "expo.inOut" });
      gsap.fromTo(this.uniforms.uTransition, { value: 1 }, { value: 0, duration: d, ease: "expo.inOut" });
      if (withCompute) gsap.fromTo(computeTransition, { value: 1 }, { value: 0, duration: d, ease: "expo.inOut" });
    }
  }

  resize() {
    (this.material.uniforms.uResolution.value as Vector2).set(
      this.gl.sizes.width * this.gl.sizes.pixelRatio,
      this.gl.sizes.height * this.gl.sizes.pixelRatio,
    );
  }

  update() {
    const { delta } = this.gl.time;
    const speed = 0.25 + this.globalSpeed * 0.75;
    const u = this.variable.material.uniforms as Record<string, IUniform<number>>;
    u.uTime.value += (delta * 0.0125 - this.gl.audio.synthFrequency * delta * 0.0005) * speed;
    u.uDeltaTime.value = delta * 0.001 * speed;
    this.computation.compute();
    this.material.uniforms.uParticlesTexture.value = this.computation.getCurrentRenderTarget(this.variable).texture;
    this.mesh.rotation.z += delta * 0.00075 * this.globalSpeed;
    u.uFrequency.value = this.gl.audio.synthFrequency * 0.001;
  }
}

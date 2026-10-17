import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Camera,
  Clock,
  FloatType,
  HalfFloatType,
  LineSegments,
  Mesh,
  PlaneGeometry,
  RawShaderMaterial,
  Scene,
  Uniform,
  Vector2,
  WebGLRenderTarget,
  type IUniform,
} from "three";
import type { GlContext } from "./core";

// Stable-fluids cursor trail: velocity is advected, pushed by pointer motion and made
// divergence-free; the output texture drives refraction on the render plane and earbud fresnel.

const faceVertex = /* glsl */ `
  attribute vec3 position;
  uniform vec2 px;
  uniform vec2 boundarySpace;
  varying vec2 uv;
  precision highp float;
  void main(){
    vec3 pos = position;
    vec2 scale = 1.0 - boundarySpace * 2.0;
    pos.xy = pos.xy * scale;
    uv = vec2(0.5)+(pos.xy)*0.5;
    gl_Position = vec4(pos, 1.0);
  }
`;

const lineVertex = /* glsl */ `
  attribute vec3 position;
  varying vec2 uv;
  uniform vec2 px;
  precision highp float;
  void main(){
    vec3 pos = position;
    uv = 0.5 + pos.xy * 0.5;
    vec2 n = sign(pos.xy);
    pos.xy = abs(pos.xy) - px * 1.0;
    pos.xy *= n;
    gl_Position = vec4(pos, 1.0);
  }
`;

const advectionFragment = (dissipateBoundary: boolean) => /* glsl */ `
  precision highp float;
  uniform sampler2D velocity;
  uniform float dt;
  uniform float dissipation;
  uniform bool isBFECC;
  uniform vec2 fboSize;
  uniform vec2 px;
  varying vec2 uv;
  void main(){
    vec2 ratio = max(fboSize.x, fboSize.y) / fboSize;
    if(isBFECC == false){
      vec2 vel = texture2D(velocity, uv).xy;
      vec2 uv2 = uv - vel * dt * ratio;
      vec2 newVel = texture2D(velocity, uv2).xy${dissipateBoundary ? " * dissipation" : ""};
      gl_FragColor = vec4(newVel, 0.0, 0.0);
    } else {
      vec2 spot_new = uv;
      vec2 vel_old = texture2D(velocity, uv).xy;
      vec2 spot_old = spot_new - vel_old * dt * ratio;
      vec2 vel_new1 = texture2D(velocity, spot_old).xy;
      vec2 spot_new2 = spot_old + vel_new1 * dt * ratio;
      vec2 error = spot_new2 - spot_new;
      vec2 spot_new3 = spot_new - error / 2.0;
      vec2 vel_2 = texture2D(velocity, spot_new3).xy;
      vec2 spot_old2 = spot_new3 - vel_2 * dt * ratio;
      vec2 newVel2 = texture2D(velocity, spot_old2).xy * dissipation;
      gl_FragColor = vec4(newVel2, 0.0, 0.0);
    }
  }
`;

type Uniforms = Record<string, IUniform>;

class Pass {
  scene = new Scene();
  camera = new Camera();
  material?: RawShaderMaterial;
  uniforms: Uniforms = {};

  constructor(
    protected renderer: GlContext["renderer"],
    public output: WebGLRenderTarget | null,
    shader?: { vertexShader: string; fragmentShader: string; uniforms: Uniforms },
  ) {
    if (shader) {
      this.uniforms = shader.uniforms;
      this.material = new RawShaderMaterial(shader);
      this.scene.add(new Mesh(new PlaneGeometry(2, 2), this.material));
    }
  }

  render() {
    this.renderer.setRenderTarget(this.output);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }
}

class PointerTracker {
  coords = new Vector2();
  coordsOld = new Vector2();
  diff = new Vector2();
  private touching = false;
  private previousTouching = false;

  constructor(private gl: GlContext) {
    window.addEventListener("mousemove", this.onMove);
    window.addEventListener("touchmove", this.onTouchMove, { passive: true });
    window.addEventListener("touchstart", this.onTouchStart, { passive: true });
    window.addEventListener("touchend", this.onTouchEnd);
  }

  private onMove = () => this.coords.copy(this.gl.mouse.normalized.current);
  private onTouchMove = (event: TouchEvent) => {
    if (event.touches.length === 1) this.coords.copy(this.gl.mouse.normalized.current);
  };
  private onTouchStart = () => {
    this.touching = true;
  };
  private onTouchEnd = () => {
    this.touching = false;
  };

  update() {
    if (this.touching !== this.previousTouching && this.touching) {
      this.coords.copy(this.gl.mouse.normalized.current);
      this.coordsOld.copy(this.gl.mouse.normalized.current);
    }
    this.diff.subVectors(this.coords, this.coordsOld);
    this.coordsOld.copy(this.coords);
    if (this.coordsOld.x === 0 && this.coordsOld.y === 0) this.diff.set(0, 0);
    this.previousTouching = this.touching;
  }

  dispose() {
    window.removeEventListener("mousemove", this.onMove);
    window.removeEventListener("touchmove", this.onTouchMove);
    window.removeEventListener("touchstart", this.onTouchStart);
    window.removeEventListener("touchend", this.onTouchEnd);
  }
}

const options = {
  iterationsPoisson: 2,
  dissipation: 0.96,
  mouseForce: 50,
  resolution: 0.075,
  cursorSize: 10,
  straightness: 1,
  dt: 0.014,
};

export class FluidCursor {
  sourceTarget: WebGLRenderTarget;
  private fboSize = new Vector2();
  private cellScale = new Vector2();
  private boundarySpace = new Vector2();
  private fbos: Record<"vel0" | "vel1" | "div" | "pressure0" | "pressure1", WebGLRenderTarget>;
  private advection: Pass;
  private force: Pass;
  private divergence: Pass;
  private poisson: Pass;
  private pressure: Pass;
  private output: Pass;
  private forceMesh: Mesh;
  private pointer: PointerTracker;
  private clock = new Clock();
  private accumulated = 0;
  private outputMouse = new Uniform(new Vector2());

  constructor(private gl: GlContext) {
    const r = gl.renderer;
    this.calcSize();
    const type = /(iPad|iPhone|iPod)/g.test(navigator.userAgent) ? HalfFloatType : FloatType;
    const make = () => new WebGLRenderTarget(this.fboSize.x, this.fboSize.y, { type });
    this.fbos = { vel0: make(), vel1: make(), div: make(), pressure0: make(), pressure1: make() };

    const advectionUniforms: Uniforms = {
      boundarySpace: { value: this.cellScale },
      px: { value: this.cellScale },
      fboSize: { value: this.fboSize },
      velocity: { value: this.fbos.vel0.texture },
      dt: { value: options.dt },
      isBFECC: { value: false },
      dissipation: { value: options.dissipation },
    };
    this.advection = new Pass(r, this.fbos.vel1, {
      vertexShader: faceVertex,
      fragmentShader: advectionFragment(true),
      uniforms: advectionUniforms,
    });
    const boundary = new BufferGeometry();
    boundary.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([-1, -1, 0, -1, 1, 0, -1, 1, 0, 1, 1, 0, 1, 1, 0, 1, -1, 0, 1, -1, 0, -1, -1, 0]), 3),
    );
    const boundaryLine = new LineSegments(
      boundary,
      new RawShaderMaterial({ vertexShader: lineVertex, fragmentShader: advectionFragment(false), uniforms: advectionUniforms }),
    );
    boundaryLine.visible = false;
    this.advection.scene.add(boundaryLine);

    this.force = new Pass(r, this.fbos.vel1);
    this.forceMesh = new Mesh(
      new PlaneGeometry(1, 1),
      new RawShaderMaterial({
        vertexShader: /* glsl */ `
          precision highp float;
          attribute vec3 position;
          attribute vec2 uv;
          uniform vec2 center;
          uniform vec2 scale;
          uniform vec2 px;
          varying vec2 vUv;
          void main(){
            vec2 pos = position.xy * scale * 2.0 * px + center;
            vUv = uv;
            gl_Position = vec4(pos, 0.0, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform vec2 force;
          varying vec2 vUv;
          void main(){
            vec2 circle = (vUv - 0.5) * 2.0;
            float d = 1.0-min(length(circle), 1.0);
            d *= d;
            gl_FragColor = vec4(force * d, 0, 1);
          }
        `,
        blending: AdditiveBlending,
        uniforms: {
          px: { value: this.cellScale },
          force: { value: new Vector2() },
          center: { value: new Vector2() },
          scale: { value: new Vector2(options.cursorSize, options.cursorSize) },
        },
      }),
    );
    this.force.scene.add(this.forceMesh);

    this.divergence = new Pass(r, this.fbos.div, {
      vertexShader: faceVertex,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D velocity;
        uniform float dt;
        uniform vec2 px;
        varying vec2 uv;
        void main(){
          float x0 = texture2D(velocity, uv-vec2(px.x, 0)).x;
          float x1 = texture2D(velocity, uv+vec2(px.x, 0)).x;
          float y0 = texture2D(velocity, uv-vec2(0, px.y)).y;
          float y1 = texture2D(velocity, uv+vec2(0, px.y)).y;
          float divergence = (x1-x0 + y1-y0) / 2.0;
          gl_FragColor = vec4(divergence / dt);
        }
      `,
      uniforms: {
        boundarySpace: { value: this.boundarySpace },
        velocity: { value: this.fbos.vel1.texture },
        px: { value: this.cellScale },
        dt: { value: options.dt },
      },
    });

    this.poisson = new Pass(r, this.fbos.pressure1, {
      vertexShader: faceVertex,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D pressure;
        uniform sampler2D divergence;
        uniform float straightness;
        uniform vec2 px;
        varying vec2 uv;
        void main(){
          float p0 = texture2D(pressure, uv+vec2(px.x * 2.0,  0)).r;
          float p1 = texture2D(pressure, uv-vec2(px.x * 2.0, 0)).r;
          float p2 = texture2D(pressure, uv+vec2(0, px.y * 2.0 )).r;
          float p3 = texture2D(pressure, uv-vec2(0, px.y * 2.0 )).r;
          float div = texture2D(divergence, uv).r;
          float newP = (p0 + p1 + p2 + p3) / (4.0 + straightness) - div;
          gl_FragColor = vec4(newP);
        }
      `,
      uniforms: {
        boundarySpace: { value: this.boundarySpace },
        pressure: { value: this.fbos.pressure0.texture },
        divergence: { value: this.fbos.div.texture },
        px: { value: this.cellScale },
        straightness: { value: options.straightness },
      },
    });

    this.pressure = new Pass(r, this.fbos.vel0, {
      vertexShader: faceVertex,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D pressure;
        uniform sampler2D velocity;
        uniform vec2 px;
        uniform float dt;
        varying vec2 uv;
        void main(){
          float p0 = texture2D(pressure, uv+vec2(px.x, 0)).r;
          float p1 = texture2D(pressure, uv-vec2(px.x, 0)).r;
          float p2 = texture2D(pressure, uv+vec2(0, px.y)).r;
          float p3 = texture2D(pressure, uv-vec2(0, px.y)).r;
          vec2 v = texture2D(velocity, uv).xy;
          vec2 gradP = vec2(p0 - p1, p2 - p3) * 0.5;
          v = v - gradP * dt;
          gl_FragColor = vec4(v, 0.0, 1.0);
        }
      `,
      uniforms: {
        boundarySpace: { value: this.boundarySpace },
        pressure: { value: this.fbos.pressure0.texture },
        velocity: { value: this.fbos.vel1.texture },
        px: { value: this.cellScale },
        dt: { value: options.dt },
      },
    });

    this.sourceTarget = new WebGLRenderTarget(gl.sizes.width, gl.sizes.height, { samples: 1 });
    this.output = new Pass(r, this.sourceTarget, {
      vertexShader: faceVertex,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D velocity;
        varying vec2 uv;
        uniform vec2 uMouse;
        void main(){
          vec2 vel = texture2D(velocity, uv).xy;
          float len = length(vel);
          vel = vel * 0.5 + 0.5;
          vec3 color = vec3(vel.x, vel.y, 1.0);
          color = mix(vec3(1.0), color, len);
          gl_FragColor = vec4((1.0 - color), 1.0);
        }
      `,
      uniforms: {
        velocity: { value: this.fbos.vel0.texture },
        uMouse: this.outputMouse,
        boundarySpace: { value: new Vector2() },
      },
    });

    this.pointer = new PointerTracker(gl);
  }

  private calcSize() {
    const width = Math.round(options.resolution * this.gl.sizes.width);
    const height = Math.round(options.resolution * this.gl.sizes.height);
    let px = 1 / width;
    let py = 1 / height;
    const reference = 1100 * options.resolution;
    if (width > reference) {
      px *= width / reference;
      py *= width / reference;
    } else {
      const factor = 1 - (1 - width / reference) * 0.5;
      px *= factor;
      py *= factor;
    }
    this.cellScale.set(px, py);
    this.fboSize.set(width, height);
  }

  resize() {
    this.calcSize();
    for (const fbo of Object.values(this.fbos)) fbo.setSize(this.fboSize.x, this.fboSize.y);
  }

  private simulate() {
    this.boundarySpace.copy(this.cellScale);
    this.advection.render();

    this.pointer.update();
    const forceUniforms = (this.forceMesh.material as RawShaderMaterial).uniforms;
    const sx = options.cursorSize * this.cellScale.x;
    const sy = options.cursorSize * this.cellScale.y;
    (forceUniforms.force.value as Vector2).set((this.pointer.diff.x / 2) * options.mouseForce, (this.pointer.diff.y / 2) * options.mouseForce);
    (forceUniforms.center.value as Vector2).set(
      Math.min(Math.max(this.pointer.coords.x, -1 + sx + this.cellScale.x * 2), 1 - sx - this.cellScale.x * 2),
      Math.min(Math.max(this.pointer.coords.y, -1 + sy + this.cellScale.y * 2), 1 - sy - this.cellScale.y * 2),
    );
    this.force.render();

    this.divergence.uniforms.velocity.value = this.fbos.vel1.texture;
    this.divergence.render();

    let pressure = this.fbos.pressure1;
    for (let i = 0; i < options.iterationsPoisson; i++) {
      const [input, output] = i % 2 === 0 ? [this.fbos.pressure0, this.fbos.pressure1] : [this.fbos.pressure1, this.fbos.pressure0];
      this.poisson.uniforms.pressure.value = input.texture;
      this.poisson.output = output;
      this.poisson.render();
      pressure = output;
    }

    this.pressure.uniforms.velocity.value = this.fbos.vel1.texture;
    this.pressure.uniforms.pressure.value = pressure.texture;
    this.pressure.render();
  }

  update(easedMouse: Vector2) {
    this.accumulated += this.clock.getDelta();
    const interval = 1 / 60;
    if (this.accumulated <= interval) return;
    this.simulate();
    this.output.render();
    this.accumulated %= interval;
    this.outputMouse.value.copy(easedMouse);
  }

  dispose() {
    this.pointer.dispose();
    for (const fbo of Object.values(this.fbos)) fbo.dispose();
    this.sourceTarget.dispose();
  }
}

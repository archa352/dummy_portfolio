import {
  Color,
  DoubleSide,
  MeshStandardMaterial,
  ShaderMaterial,
  Texture,
  Uniform,
  Vector2,
  Vector3,
  type MeshStandardMaterialParameters,
  type WebGLProgramParametersWithUniforms,
} from "three";
import type { AetherAssets } from "./core";

const COLOR_FRESNEL = 0x60b2ff;
const ENV_COLOR = 0x182d3d;

type Shader = WebGLProgramParametersWithUniforms;

function withUniforms<T extends Record<string, Uniform>>(material: MeshStandardMaterial, uniforms: T, patch: (shader: Shader) => void) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    patch(shader);
  };
  // Each instance patches its own program.
  material.customProgramCacheKey = () => material.uuid;
  return { material, uniforms };
}

export function createCaseMaterial(assets: AetherAssets, params: MeshStandardMaterialParameters) {
  const material = new MeshStandardMaterial({ ...params, transparent: true });
  const uniforms = {
    uPosition: new Uniform(new Vector3()),
    uFresnelTransition: new Uniform(3),
    uColorTransition: new Uniform(3),
    uEnvColor: new Uniform(new Color(ENV_COLOR)),
    uEnvIntensity: new Uniform(1.5),
    tMatcap: new Uniform(assets.textures.matcapGlass),
    tMatcapMask: new Uniform(assets.textures.case.matcapMask),
    COLOR_FRESNEL: new Uniform(new Color(COLOR_FRESNEL)),
  };
  return withUniforms(material, uniforms, (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("varying vec3 vViewPosition;", "varying vec3 vViewPosition;\nvarying vec3 vTransformed;")
      .replace("#include <fog_vertex>", "#include <fog_vertex>\nvTransformed = transformed;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "varying vec3 vViewPosition;",
        /* glsl */ `
        varying vec3 vViewPosition;
        varying vec3 vTransformed;
        uniform vec3 uPosition;
        uniform float uFresnelTransition;
        uniform float uColorTransition;
        uniform vec3 uEnvColor;
        uniform float uEnvIntensity;
        uniform sampler2D tMatcap;
        uniform sampler2D tMatcapMask;
        uniform vec3 COLOR_FRESNEL;
        const float TRANSITION_SIZE_FRESNEL = 1.5;
        const float TRANSITION_SIZE_COLOR = 0.75;
      `,
      )
      .replace(
        "#include <dithering_fragment>",
        /* glsl */ `
        #include <dithering_fragment>
        float textureMatcapMask = 1.0 - texture2D( tMatcapMask, vAoMapUv ).r;
        float localPosition = length(vTransformed.x) * 0.01;
        float transitionGap = smoothstep(localPosition, localPosition + TRANSITION_SIZE_COLOR, uColorTransition) * smoothstep(localPosition + TRANSITION_SIZE_COLOR, localPosition , uColorTransition) * 4.0;
        vec3 viewDirection = normalize(vViewPosition);
        float fresnel = 1.0 - dot(viewDirection, vNormal);
        vec3 x = normalize( vec3( viewDirection.z, 0.0, -viewDirection.x ) );
        vec3 y = cross( viewDirection, x );
        vec2 matcapUV = vec2( dot( x, vNormal ), dot( y, vNormal ) ) * 0.495 + 0.5;
        vec3 textureMatcapGlass = texture2D( tMatcap, matcapUV ).rgb;
        vec3 baseColor = min(outgoingLight + (pow(textureMatcapGlass.r, 3.0) * 0.5 * textureMatcapMask + mix(vec3(1.0), COLOR_FRESNEL, 0.85) * pow(fresnel, 1.0) + pow(fresnel, 3.0) * 1.0) * min(0.25 + step(diffuseColor.a, 0.9), 1.0), 1.0) + (uEnvColor * uEnvIntensity);
        vec3 fresnelColor = min(COLOR_FRESNEL + pow(fresnel, 3.0), 1.0);
        float fresnelAlpha = mix(0.0, fresnel, smoothstep(localPosition, localPosition + TRANSITION_SIZE_FRESNEL, uFresnelTransition));
        float colorAlpha = mix(0.0, min(diffuseColor.a + fresnel + totalEmissiveRadiance.r, 1.0), smoothstep(localPosition, localPosition + TRANSITION_SIZE_COLOR, uColorTransition));
        vec3 finalColor = mix(fresnelColor, baseColor, smoothstep(localPosition, localPosition + TRANSITION_SIZE_COLOR, uColorTransition));
        finalColor += vec3(transitionGap * COLOR_FRESNEL);
        vec3 bottomDiffuse = (diffuseColor.rgb + outgoingLight);
        gl_FragColor = vec4( mix(bottomDiffuse, finalColor, textureMatcapMask) * ambientOcclusion, max(fresnelAlpha, colorAlpha) );
      `,
      );
  });
}

const fluidVaryingsVertex = (shader: Shader) => {
  shader.vertexShader = shader.vertexShader
    .replace(
      "varying vec3 vViewPosition;",
      "varying vec3 vViewPosition;\nvarying vec3 vTransformed;\nvarying vec4 vNormalizedViewPosition;",
    )
    .replace(
      "#include <fog_vertex>",
      "#include <fog_vertex>\nvTransformed = transformed;\nvNormalizedViewPosition = projectionMatrix * mvPosition;",
    );
};

export function createGlassMaterial(assets: AetherAssets, params: MeshStandardMaterialParameters) {
  const material = new MeshStandardMaterial({ ...params, transparent: true });
  const uniforms = {
    tMatcap: new Uniform(assets.textures.matcapGlass),
    tEmissiveMask: new Uniform(assets.textures.headphones.emissiveMask),
    tFluidCursor: new Uniform<Texture | null>(null),
    uEmissiveTransition: new Uniform(0),
    uEmissiveHover: new Uniform(0),
    uFresnelTransition: new Uniform(0),
    uEnvColor: new Uniform(new Color(ENV_COLOR)),
    uEnvIntensity: new Uniform(1.5),
    COLOR_FRESNEL: new Uniform(new Color(COLOR_FRESNEL)),
  };
  return withUniforms(material, uniforms, (shader) => {
    fluidVaryingsVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "varying vec3 vViewPosition;",
        /* glsl */ `
        varying vec3 vViewPosition;
        varying vec3 vTransformed;
        varying vec4 vNormalizedViewPosition;
        uniform sampler2D tMatcap;
        uniform sampler2D tEmissiveMask;
        uniform sampler2D tFluidCursor;
        uniform vec3 COLOR_FRESNEL;
        uniform float uEmissiveTransition;
        uniform float uEmissiveHover;
        uniform float uFresnelTransition;
        uniform vec3 uEnvColor;
        uniform float uEnvIntensity;
      `,
      )
      .replace(
        "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
        /* glsl */ `
        float textureEmissiveMask = 1.0 - texture2D( tEmissiveMask, vEmissiveMapUv ).r;
        vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance * min(1.0, textureEmissiveMask + max(uEmissiveTransition, uEmissiveHover));
      `,
      )
      .replace(
        "#include <dithering_fragment>",
        /* glsl */ `
        #include <dithering_fragment>
        vec3 fluidCursor = texture2D( tFluidCursor, (vNormalizedViewPosition.xy / vNormalizedViewPosition.w) * 0.5 + 0.5 ).rgb;
        vec3 viewDirection = normalize(vViewPosition);
        float fresnel = 1.0 - dot(viewDirection, normal);
        float fresnelMask = fluidCursor.r + fluidCursor.g + fluidCursor.b;
        fresnelMask = smoothstep(0.0, 0.5, fresnelMask);
        fresnelMask *= uFresnelTransition;
        vec3 x = normalize( vec3( viewDirection.z, 0.0, -viewDirection.x ) );
        vec3 y = cross( viewDirection, x );
        vec2 matcapUV = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
        vec3 textureMatcapGlass = texture2D( tMatcap, matcapUV ).rgb;
        vec3 baseColor = outgoingLight + (uEnvColor * uEnvIntensity) + mix(vec3(1.0), COLOR_FRESNEL, 0.75) * pow(fresnel, 2.0) + pow(fresnel, 4.0) * 0.5 + pow(textureMatcapGlass.r, 3.0) * 0.1;
        vec3 fresnelColor = min(COLOR_FRESNEL + pow(fresnel, 3.0), 1.0);
        float baseAlpha = 0.9 + baseColor.r * 0.1;
        float fresnelAlpha = max(fresnel, 0.0);
        vec3 finalColor = mix(baseColor, fresnelColor, fresnelMask);
        float finalAlpha = mix(baseAlpha, fresnelAlpha, fresnelMask);
        gl_FragColor = vec4(finalColor, finalAlpha);
      `,
      );
  });
}

export function createBaseMaterial(assets: AetherAssets, params: MeshStandardMaterialParameters) {
  const material = new MeshStandardMaterial({ ...params, transparent: true });
  const uniforms = {
    COLOR_FRESNEL: new Uniform(new Color(COLOR_FRESNEL)),
    uFresnelTransition: new Uniform(0),
    uVolumeUpHover: new Uniform(0),
    uVolumeDownHover: new Uniform(0),
    uVolumeShadowUp: new Uniform(0),
    uVolumeShadowDown: new Uniform(0),
    uEnvColor: new Uniform(new Color(ENV_COLOR)),
    uEnvIntensity: new Uniform(15),
    tFluidCursor: new Uniform<Texture | null>(null),
    tEmissiveMask: new Uniform(assets.textures.headphones.emissiveMask),
    tVolumeShadowMask: new Uniform(assets.textures.headphones.volumeShadowMask),
    tMatcap: new Uniform(assets.textures.matcapGlass),
  };
  return withUniforms(material, uniforms, (shader) => {
    fluidVaryingsVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "varying vec3 vViewPosition;",
        /* glsl */ `
        varying vec3 vViewPosition;
        varying vec3 vTransformed;
        varying vec4 vNormalizedViewPosition;
        uniform float uFresnelTransition;
        uniform float uVolumeUpHover;
        uniform float uVolumeDownHover;
        uniform float uVolumeShadowUp;
        uniform float uVolumeShadowDown;
        uniform vec3 uEnvColor;
        uniform float uEnvIntensity;
        uniform sampler2D tFluidCursor;
        uniform sampler2D tEmissiveMask;
        uniform sampler2D tVolumeShadowMask;
        uniform sampler2D tMatcap;
        uniform vec3 COLOR_FRESNEL;
      `,
      )
      .replace(
        "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
        /* glsl */ `
        vec3 textureEmissiveMask = texture2D( tEmissiveMask, vEmissiveMapUv ).rgb;
        vec3 textureVolumeShadowMask = texture2D( tVolumeShadowMask, vEmissiveMapUv ).rgb;
        float hoverMaskUp = textureEmissiveMask.g * (0.75 + uVolumeUpHover * 0.5);
        float hoverMaskDown = textureEmissiveMask.b * (0.75 + uVolumeDownHover * 0.5);
        float shadowUp = textureVolumeShadowMask.g * uVolumeShadowUp;
        float shadowDown = textureVolumeShadowMask.b * uVolumeShadowDown;
        vec3 outgoingLight = (uEnvColor * uEnvIntensity) * ambientOcclusion + (totalDiffuse - (shadowUp + shadowDown)) + totalSpecular + totalEmissiveRadiance * (hoverMaskUp + hoverMaskDown);
      `,
      )
      .replace(
        "#include <dithering_fragment>",
        /* glsl */ `
        #include <dithering_fragment>
        vec3 fluidCursor = texture2D( tFluidCursor, (vNormalizedViewPosition.xy / vNormalizedViewPosition.w) * 0.5 + 0.5 ).rgb;
        vec3 viewDirection = normalize(vViewPosition);
        float fresnel = 1.0 - dot(viewDirection, normal);
        float fresnelMask = fluidCursor.r + fluidCursor.g + fluidCursor.b;
        fresnelMask = smoothstep(0.0, 0.5, fresnelMask);
        fresnelMask *= uFresnelTransition;
        vec3 x = normalize( vec3( viewDirection.z, 0.0, -viewDirection.x ) );
        vec3 y = cross( viewDirection, x );
        vec2 matcapUV = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
        float textureMatcapMetallic = texture2D( tMatcap, matcapUV ).r;
        vec3 fresnelColor = min(COLOR_FRESNEL + pow(fresnel, 3.0), 1.0);
        vec3 siliconeColor = diffuseColor.rgb * ambientOcclusion + totalSpecular;
        siliconeColor += (1.0 - textureMatcapMetallic * 2.0) * 0.05;
        float fresnelAlpha = max(fresnel, 0.0);
        vec3 finalColor = mix(outgoingLight, fresnelColor, fresnelMask);
        finalColor = mix(finalColor, siliconeColor, step(roughnessFactor, 0.5));
        float finalAlpha = mix(1.0, fresnelAlpha, fresnelMask);
        gl_FragColor = vec4(finalColor, finalAlpha);
      `,
      );
  });
}

export function createCoreMaterial(assets: AetherAssets) {
  return new ShaderMaterial({
    uniforms: {
      uTime: new Uniform(0),
      COLOR_PURPLE: new Uniform(new Color(0xbec0fe)),
      tNoise: new Uniform(assets.textures.noise),
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec4 vViewPosition;
      varying vec3 vNormal;
      void main() {
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        vUv = uv;
        vViewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalMatrix * normal;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec4 vViewPosition;
      varying vec3 vNormal;
      uniform float uTime;
      uniform vec3 COLOR_PURPLE;
      uniform sampler2D tNoise;
      void main() {
        float textureDistort = texture2D(tNoise, vUv * 4.0 + uTime * 0.1).r;
        float textureNoise = texture2D(tNoise, vUv + (textureDistort * 2.0 + 1.0) * 0.1 + uTime * 0.01).r;
        float fresnel = dot(normalize(-vViewPosition.xyz), normalize(vNormal));
        fresnel = 1.0 - pow(fresnel, 2.0);
        float final = smoothstep(0.35, 0.5, textureNoise);
        final -= smoothstep(0.5, 0.75, textureDistort) * 0.25;
        final += fresnel;
        final = min(final, 1.0);
        vec3 color = mix(COLOR_PURPLE, vec3(1.0), final);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

export function createBloomMaterial(assets: AetherAssets) {
  return new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tAlpha: new Uniform(assets.textures.bloom),
      uOpacity: new Uniform(0),
      uTime: new Uniform(0),
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tAlpha;
      uniform float uOpacity;
      uniform float uTime;
      void main() {
        float alpha = texture2D(tAlpha, vUv).r;
        float flicker = sin(sin(sin(uTime * 10.0) + uTime) - uTime) * 0.5 + 0.5;
        gl_FragColor = vec4(1.0, 1.0, 1.0, uOpacity * alpha - flicker * 0.025);
      }
    `,
  });
}

export function createTubeMaterial() {
  return new ShaderMaterial({
    transparent: true,
    uniforms: {
      uColor: new Uniform(new Color(0xb2e0ff)),
      uLineSize: new Uniform(0.0025),
      uBokeh: new Uniform(0),
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uLineSize;
      uniform float uBokeh;
      void main() {
        vec2 uv0 = vec2(vUv.x * 35.0, vUv.y * 22.5);
        float maskY = distance(fract(uv0.y), 0.5);
        maskY = 1.0 - smoothstep(0.0 + uLineSize, 0.0 + uLineSize + uBokeh, maskY);
        float maskX = distance(fract(uv0.x), 0.5);
        maskX = 1.0 - smoothstep(0.0 + uLineSize, 0.0 + uLineSize + uBokeh, maskX);
        float maskSkew = distance(fract(uv0.x + (uv0.y + 0.5)), 0.5);
        maskSkew = 1.0 - smoothstep(0.0 + uLineSize * 2.0, 0.0 + uLineSize * 2.0 + uBokeh * 2.0, maskSkew);
        float mask = min(maskY + maskX + maskSkew, 1.0);
        float alpha = smoothstep(0.7, 0.6, vUv.y) * 0.1 - uBokeh;
        gl_FragColor = vec4(uColor, alpha * mask);
      }
    `,
  });
}

export function createTouchPadMaterial(assets: AetherAssets) {
  return new ShaderMaterial({
    transparent: true,
    depthTest: false,
    uniforms: {
      uOpacity: new Uniform(0),
      uTime: new Uniform(0),
      uReveal: new Uniform(0),
      uMouseUv: new Uniform(new Vector2(0, 0)),
      uFrequency: new Uniform(1),
      tNoise: new Uniform(assets.textures.noise),
      tMatcap: new Uniform(assets.textures.matcapGlass),
      COLOR_BASE: new Uniform(new Color(0xb4dfe7).convertLinearToSRGB()),
      COLOR_CORNERS: new Uniform(new Color(0x8bccda).convertLinearToSRGB()),
      COLOR_VISUALISER: new Uniform(new Color(COLOR_FRESNEL)),
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec4 vViewPosition;
      void main() {
        vUv = uv;
        vViewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec4 vViewPosition;
      uniform sampler2D tNoise;
      uniform float uTime;
      uniform float uReveal;
      uniform float uFrequency;
      uniform vec3 COLOR_BASE;
      uniform vec3 COLOR_CORNERS;
      uniform vec3 COLOR_VISUALISER;
      uniform vec2 uMouseUv;
      void main() {
        vec2 uv0 = vUv * 2.0 - 1.0;
        float fresnel = 1.0 - dot(normalize(-vViewPosition.xyz), normalize(vNormal));
        fresnel = pow(fresnel, 2.0);
        vec2 mousePosition = (uMouseUv * 2.0 - 1.0);
        float dist = length(uv0);
        float visualiserDist = distance(uv0, vec2(0.0) + mousePosition * 0.33);
        float reveal = -0.5 + uReveal * 1.5;
        float distortion = texture2D(tNoise, uv0 * (0.75 + (1.0 - dist) * 2.0) + uTime ).r * 2.0 - 1.0;
        float noise = smoothstep(0.5 - reveal - distortion * (1.0 - dist), 1.0 - reveal - distortion * (1.0 - dist), 1.0 - dist);
        float baseGradient = smoothstep(0.5, 1.0, dist);
        vec3 base = mix(COLOR_BASE, COLOR_CORNERS, baseGradient);
        float visualiserNoiseR = texture2D(tNoise, vUv * 0.33 + uTime * 0.33).r * 2.0 - 1.0;
        float visualiserNoiseG = texture2D(tNoise, vUv * 0.33 + uTime * 0.66).g * 2.0 - 1.0;
        float visualiserNoiseB = texture2D(tNoise, vUv * 0.33 + uTime * 1.0).b * 2.0 - 1.0;
        float visualiserR = smoothstep(0.5, 1.0, visualiserDist + visualiserNoiseR * uFrequency);
        float visualiserG = smoothstep(0.5, 1.0, visualiserDist + visualiserNoiseG * uFrequency);
        float visualiserB = smoothstep(0.5, 1.0, visualiserDist + visualiserNoiseB * uFrequency);
        vec3 visualiser = vec3(visualiserR, visualiserG, visualiserB);
        vec3 final = mix(base, COLOR_VISUALISER, visualiser);
        gl_FragColor = vec4(final + fresnel * 0.5, noise * smoothstep(0.0, 0.5, uReveal) * smoothstep(1.0, 0.8 + min(1.0 - visualiserDist, 0.15), dist));
      }
    `,
  });
}

export function createSiliconeMaterial(assets: AetherAssets) {
  return new ShaderMaterial({
    transparent: true,
    side: DoubleSide,
    uniforms: {
      tDiffuse: new Uniform(assets.textures.earphoneSilicone),
      COLOR_FRESNEL: new Uniform(new Color(COLOR_FRESNEL)),
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vLight;
      void main() {
        vLight = smoothstep(0.85, 1.0, dot(normalize(normalMatrix * normal), normalize(vec3(1.0, 1.0, 0.0))));
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vLight;
      uniform sampler2D tDiffuse;
      void main() {
        vec3 textureDiffuse = texture2D(tDiffuse, vUv).rgb;
        gl_FragColor = vec4(textureDiffuse + vLight, 1.0);
      }
    `,
  });
}

export type CaseMaterial = ReturnType<typeof createCaseMaterial>;
export type GlassMaterial = ReturnType<typeof createGlassMaterial>;
export type BaseMaterial = ReturnType<typeof createBaseMaterial>;

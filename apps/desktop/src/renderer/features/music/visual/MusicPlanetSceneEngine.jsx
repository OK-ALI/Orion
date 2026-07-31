import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMusic } from '../context/MusicProvider';

function Starfield({ count = 5000, visualBus, sceneSpeed }) {
  const points = useRef();
  const material = useRef();
  const uniforms = useMemo(() => ({ size: { value: 4.2 }, energy: { value: 0 }, color: { value: new THREE.Color("#e6e6e0") } }), []);

  // Create geometry directly using standard Three.js to avoid R3F mapping issues
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);

  useFrame((state, delta) => {
    if (!points.current || !material.current) return;
    const frame = visualBus ? visualBus.getFrame() : null;
    const energy = frame ? frame.energy : 0;
    const bass = frame ? frame.bass : 0;
    const speedMultiplier = 1 + (energy * 3);
    
    points.current.rotation.y -= delta * sceneSpeed * speedMultiplier;
    points.current.rotation.x -= delta * sceneSpeed * 0.5 * speedMultiplier;
    uniforms.energy.value += (Math.max(energy, bass) - uniforms.energy.value) * 0.12;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        transparent
        uniforms={uniforms}
        vertexShader={`uniform float size; uniform float energy; void main(){ vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_PointSize=(size+energy*3.0)*(260.0/max(1.0,-mvPosition.z)); gl_Position=projectionMatrix*mvPosition; }`}
        fragmentShader={`uniform vec3 color; uniform float energy; void main(){ float distanceFromCenter=distance(gl_PointCoord,vec2(.5)); if(distanceFromCenter>.5) discard; float alpha=smoothstep(.5,.16,distanceFromCenter)*(0.34+energy*.38); gl_FragColor=vec4(color,alpha); }`}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

const vertexShader = `
uniform float time;
uniform float bass;
uniform float beat;
uniform float mids;
varying vec2 vUv;
varying float vDisplacement;

// Simplex 3D Noise
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

void main() {
  vUv = uv;
  // Displace based on time and audio bass
  float noise = snoise(vec3(position.x * 1.5 + time * 0.5, position.y * 1.5 + time * 0.3, position.z * 1.5 + time * 0.4));
  
  // Calm organic breathing remains visible at rest. Only analyser data can add
  // musical deformation; loading and network state never reach this shader.
  float idleScale = 0.10 + 0.035 * sin(time * 1.2);
  float intensity = min(0.42, idleScale + (bass * 0.24) + (beat * 0.12) + (mids * 0.08));
  vDisplacement = noise * intensity;
  
  vec3 newPosition = position + normal * vDisplacement;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

const fragmentShader = `
uniform vec3 color;
uniform float bass;
uniform float beat;
uniform float treble;
varying vec2 vUv;
varying float vDisplacement;

void main() {
  // Base core color combined with displacement height
  vec3 baseColor = color;
  vec3 highlightColor = vec3(1.0, 1.0, 1.0); // Bright white hot core
  
  float mixRatio = smoothstep(-0.2, 0.5, vDisplacement);
  vec3 finalColor = mix(baseColor, highlightColor, mixRatio * 0.8);
  
  // Add base glow and alpha
  float alpha = 0.5 + (bass * 0.3) + (beat * 0.18) + (treble * 0.06);
  
  gl_FragColor = vec4(finalColor, min(alpha, 1.0));
}
`;

function CoreMesh({ visualBus, starColor, visualIntensity = 0.65, anchor = [0, 0, -7] }) {
  const mesh = useRef();
  const material = useRef();
  const targetScale = useRef(new THREE.Vector3(1, 1, 1));
  const targetPosition = useMemo(() => new THREE.Vector3(...anchor), [anchor]);
  const lastVisualTimestamp = useRef(0);
  const consumedFrames = useRef(0);
  const lastDiagnosticAt = useRef(0);
  
  // Uniforms for the shader
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    bass: { value: 0 },
    beat: { value: 0 },
    mids: { value: 0 },
    treble: { value: 0 },
    color: { value: new THREE.Color(starColor) }
  }), []);

  // Update color dynamically when route changes
  useEffect(() => {
    uniforms.color.value.set(starColor);
  }, [starColor]);

  useFrame((state, delta) => {
    if (!mesh.current || !material.current) return;
    
    // Time evolution
    uniforms.time.value += delta;
    
    // Audio reactivity
    const frame = visualBus ? visualBus.getFrame() : null;
    const currentBass = (frame ? frame.bass : 0) * visualIntensity;
    const currentBeat = (frame ? frame.beat : 0) * visualIntensity;
    const currentMids = (frame ? frame.mids : 0) * visualIntensity;
    const currentTreble = (frame ? frame.treble : 0) * visualIntensity;
    if (frame?.timestamp && frame.timestamp !== lastVisualTimestamp.current) {
      lastVisualTimestamp.current = frame.timestamp;
      consumedFrames.current += 1;
    }
    if (state.clock.elapsedTime - lastDiagnosticAt.current > 0.5) {
      lastDiagnosticAt.current = state.clock.elapsedTime;
      document.documentElement.dataset.musicOrbFrames = String(consumedFrames.current);
      document.documentElement.dataset.musicOrbEnergy = (frame?.energy || 0).toFixed(4);
    }
    // Smooth the bass transitions
    uniforms.bass.value += (currentBass - uniforms.bass.value) * 0.1;
    uniforms.beat.value += (currentBeat - uniforms.beat.value) * 0.2;
    uniforms.mids.value += (currentMids - uniforms.mids.value) * 0.1;
    uniforms.treble.value += (currentTreble - uniforms.treble.value) * 0.1;
    
    mesh.current.rotation.y += delta * 0.1;
    mesh.current.rotation.x += delta * 0.05;
    mesh.current.position.lerp(targetPosition, 0.055);
    const pulse = 1 + uniforms.bass.value * 0.055 + uniforms.beat.value * 0.075;
    targetScale.current.set(pulse, pulse, pulse);
    mesh.current.scale.lerp(targetScale.current, 0.16);
  });

  return (
    <mesh ref={mesh} position={[0, 0, -7]}>
      {/* High-res sphere for vertex displacement */}
      <sphereGeometry args={[2.5, 128, 128]} />
      <shaderMaterial 
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function resolveThreeColor(colorStr, fallback) {
  if (!colorStr || typeof colorStr !== 'string') return fallback;
  let color = colorStr.trim();
  
  if (color.startsWith('var(')) {
    const varName = color.slice(4, -1).trim();
    const resolved = typeof window !== 'undefined' ? window.getComputedStyle(document.documentElement).getPropertyValue(varName).trim() : '';
    color = resolved || fallback;
  }
  
  const srgbMatch = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/i);
  if (srgbMatch) {
    const r = Math.round(parseFloat(srgbMatch[1]) * 255);
    const g = Math.round(parseFloat(srgbMatch[2]) * 255);
    const b = Math.round(parseFloat(srgbMatch[3]) * 255);
    return 'rg' + 'b(' + r + ', ' + g + ', ' + b + ')';
  }
  
  return color;
}

export default function MusicPlanetSceneEngine({ sceneState = 'idle-space', visualPreferences = {} }) {
  const { visualBus, artwork } = useMusic();

  const sceneConfig = {
    'idle-space': { color: '#050508', starColor: '#5c60f5', fov: 60, speed: 0.05, anchor: [0, 0, -7] },
    'library': { color: '#0a0a14', starColor: '#7d5fff', fov: 55, speed: 0.1, anchor: [3.1, 0, -7] },
    'playlists': { color: '#07070d', starColor: '#8b7cf6', fov: 70, speed: 0.08, anchor: [-3.1, 0, -7] },
    'favorites': { color: '#090711', starColor: '#9b82f6', fov: 62, speed: 0.08, anchor: [3.1, 0, -7] },
    'albums': { color: '#1a0b12', starColor: '#e50914', fov: 50, speed: 0.15, anchor: [-3.1, 0, -7] },
    'artists': { color: '#141405', starColor: '#ffd700', fov: 65, speed: 0.07, anchor: [3.1, 0, -7] },
    'now-playing': { color: '#05020a', starColor: '#b779f7', fov: 48, speed: 0.2, anchor: [-3.1, 0, -7] },
    'queue-satellites': { color: '#05020b', starColor: '#a020f0', fov: 52, speed: 0.18, anchor: [-3.1, 0, -7] },
    'lyrics-rings': { color: '#050509', starColor: '#e6e2ef', fov: 52, speed: 0.12, anchor: [0, 0, -7] }
  };

  const config = sceneConfig[sceneState] || sceneConfig['idle-space'];
  
  // Dynamic color override: blend the star/orb core color with the playing track's artwork palette
  const effectiveStarColor = useMemo(() => {
    return resolveThreeColor(artwork?.palette?.primary || config.starColor, config.starColor);
  }, [artwork?.palette?.primary, config.starColor]);
  
  // Calculate particle count based on settings
  let count = 2000;
  if (visualPreferences.particleDensity === 'low' || visualPreferences.lowGpu) count = 500;
  if (visualPreferences.particleDensity === 'high') count = 5000;
  const sceneStyle = visualPreferences.sceneStyle || "aurora";
  if (sceneStyle === "aurora") count = Math.min(count, 260);
  if (sceneStyle === "dust") count = Math.min(count, 720);
  if (sceneStyle === "minimal") count = 0;
  const audioReactive = !visualPreferences.disableAudioReactiveBg
    && visualPreferences.atmosphere !== "off" && !visualPreferences.reduceMotion;
  const visualIntensity = Math.max(0, Math.min(1, Number(visualPreferences.intensity ?? 65) / 100));

  return (
    <div className="music-planet-canvas-container" data-scene-style={sceneStyle} style={{ "--music-scene-color": config.color }}>
      {!visualPreferences.staticBg && (
        <Canvas camera={{ position: [0, 0, 10], fov: config.fov }}>
          <ambientLight intensity={0.5} />
          {count > 0 && <Starfield visualBus={audioReactive ? visualBus : null} sceneSpeed={config.speed} count={count} />}
          <CoreMesh visualBus={audioReactive ? visualBus : null} starColor={effectiveStarColor}
            visualIntensity={visualIntensity} anchor={config.anchor} />
        </Canvas>
      )}
    </div>
  );
}

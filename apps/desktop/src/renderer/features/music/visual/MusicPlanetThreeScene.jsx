import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Starfield({ count = 5000, visualBus, sceneSpeed }) {
  const points = useRef();
  const material = useRef();
  const uniforms = useMemo(
    () => ({
      size: { value: 4.2 },
      energy: { value: 0 },
      color: { value: new THREE.Color("#e6e6e0") },
    }),
    [],
  );

  const geometry = useMemo(() => {
    const nextGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 50;
      positions[index * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[index * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    nextGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return nextGeometry;
  }, [count]);


  useFrame((state, delta) => {
    if (!points.current || !material.current) return;
    const frame = visualBus ? visualBus.getFrame() : null;
    const energy = frame ? frame.energy : 0;
    const bass = frame ? frame.bass : 0;
    const speedMultiplier = 1 + energy * 3;

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
        vertexShader={"uniform float size; uniform float energy; void main(){ vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_PointSize=(size+energy*3.0)*(260.0/max(1.0,-mvPosition.z)); gl_Position=projectionMatrix*mvPosition; }"}
        fragmentShader={"uniform vec3 color; uniform float energy; void main(){ float distanceFromCenter=distance(gl_PointCoord,vec2(.5)); if(distanceFromCenter>.5) discard; float alpha=smoothstep(.5,.16,distanceFromCenter)*(0.34+energy*.38); gl_FragColor=vec4(color,alpha); }"}
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

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
  vUv = uv;
  float noise = snoise(vec3(
    position.x * 1.5 + time * 0.5,
    position.y * 1.5 + time * 0.3,
    position.z * 1.5 + time * 0.4
  ));
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
  vec3 baseColor = color;
  vec3 highlightColor = vec3(1.0, 1.0, 1.0);
  float mixRatio = smoothstep(-0.2, 0.5, vDisplacement);
  vec3 finalColor = mix(baseColor, highlightColor, mixRatio * 0.8);
  float alpha = 0.5 + (bass * 0.3) + (beat * 0.18) + (treble * 0.06);
  gl_FragColor = vec4(finalColor, min(alpha, 1.0));
}
`;

function CoreMesh({
  visualBus,
  starColor,
  visualIntensity = 0.65,
  segments = 128,
  world,
}) {
  const mesh = useRef();
  const material = useRef();
  const targetScale = useRef(new THREE.Vector3(1, 1, 1));
  const targetPosition = useMemo(() => new THREE.Vector3(...world), [world]);
  const lastVisualTimestamp = useRef(0);
  const consumedFrames = useRef(0);
  const lastDiagnosticAt = useRef(0);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      bass: { value: 0 },
      beat: { value: 0 },
      mids: { value: 0 },
      treble: { value: 0 },
      color: { value: new THREE.Color(starColor) },
    }),
    [],
  );

  useEffect(() => {
    uniforms.color.value.set(starColor);
  }, [starColor, uniforms]);

  useFrame((state, delta) => {
    if (!mesh.current || !material.current) return;

    uniforms.time.value += delta;

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
    <mesh ref={mesh} position={world}>
      <sphereGeometry args={[2.5, segments, segments]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function MusicPlanetThreeScene({
  visualBus,
  sceneSpeed,
  count,
  starColor,
  visualIntensity,
  segments,
  placement,
}) {
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: placement.fov }}>
      <ambientLight intensity={0.5} />
      {count > 0 && (
        <Starfield
          visualBus={visualBus}
          sceneSpeed={sceneSpeed}
          count={count}
        />
      )}
      <CoreMesh
        visualBus={visualBus}
        starColor={starColor}
        visualIntensity={visualIntensity}
        segments={segments}
        world={placement.world}
      />
    </Canvas>
  );
}

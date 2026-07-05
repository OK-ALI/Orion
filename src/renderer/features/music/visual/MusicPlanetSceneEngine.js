const THEME_FALLBACKS = {
  "--bg-base": "#08070c",
  "--music-palette-base-1": "#09081a",
  "--music-palette-primary-1": "#8b5cf6",
  "--music-palette-spectral-1": "#22d3ee",
  "--music-palette-base-2": "#100719",
  "--music-palette-primary-2": "#d946ef",
  "--music-palette-spectral-2": "#67e8f9",
  "--music-palette-base-3": "#06111c",
  "--music-palette-primary-3": "#6366f1",
  "--music-palette-spectral-3": "#2dd4bf",
  "--music-palette-base-4": "#130a13",
  "--music-palette-primary-4": "#a855f7",
  "--music-palette-spectral-4": "#f472b6",
  "--music-violet": "#8b5cf6",
  "--music-cyan": "#22d3ee",
  "--music-magenta": "#d946ef"
};

export default class MusicPlanetSceneEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.options = {
      lowGpu: false,
      reduceMotion: false,
      staticBg: false,
      disableAudioReactivity: false,
      batterySaver: false,
      particleDensity: "medium",
      intensity: 65,
      ...options
    };

    this.particles = [];
    this.state = "idle-space";
    this.targetState = "idle-space";
    this.transitionProgress = 1.0;
    this.transitionDuration = 800; // ms
    this.lastStateChange = performance.now();

    this.width = 0;
    this.height = 0;
    this.rafId = null;
    this.running = false;
    this.scrollProgress = 0;
    this.time = 0;
    this.lastFrameTime = performance.now();

    this.audioData = { bass: 0, mids: 0, highs: 0, volume: 0, energy: 0 };
    this.palette = {
      base: "#07070b",
      primary: "rgba(125, 95, 255, 0.45)",
      spectral: "rgba(0, 220, 255, 0.25)"
    };

    this.resize();
    this.initParticles();
  }

  updateOptions(newOptions) {
    const oldDensity = this.options.particleDensity;
    const oldLowGpu = this.options.lowGpu;
    const oldStaticBg = this.options.staticBg;

    this.options = { ...this.options, ...newOptions };

    if (
      this.options.particleDensity !== oldDensity ||
      this.options.lowGpu !== oldLowGpu ||
      this.options.staticBg !== oldStaticBg
    ) {
      this.initParticles();
    }
  }

  updatePalette(palette) {
    if (!palette) return;
    this.palette = {
      base: palette.base || "#07070b",
      primary: palette.primary || "rgba(125, 95, 255, 0.45)",
      spectral: palette.spectral || "rgba(0, 220, 255, 0.25)"
    };
  }

  updateAudio(frame) {
    if (this.options.disableAudioReactivity || this.options.lowGpu) {
      this.audioData = { bass: 0, mids: 0, highs: 0, volume: 0, energy: 0 };
    } else {
      this.audioData = {
        bass: frame.bass || 0,
        mids: frame.mids || 0,
        highs: frame.treble || 0,
        volume: frame.energy || 0,
        energy: frame.energy || 0
      };
    }
  }

  updateScroll(progress) {
    this.scrollProgress = progress;
  }

  setState(newState) {
    if (newState === this.targetState) return;
    this.state = this.targetState;
    this.targetState = newState;
    this.transitionProgress = 0.0;
    this.lastStateChange = performance.now();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : this.canvas.getBoundingClientRect();
    const ratio = Math.min(1.5, window.devicePixelRatio || 1);
    this.width = Math.max(100, Math.round(rect.width * ratio));
    this.height = Math.max(100, Math.round(rect.height * ratio));

    if (this.canvas.width !== this.width || this.canvas.height !== this.height) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }
  }

  initParticles() {
    this.particles = [];
    if (this.options.staticBg) return;

    let count = 200;
    if (this.options.lowGpu) {
      count = 40;
    } else if (this.options.particleDensity === "low") {
      count = 50;
    } else if (this.options.particleDensity === "high") {
      count = 400;
    } else if (this.options.particleDensity === "medium") {
      count = 200;
    }

    if (this.options.reduceMotion) {
      count = Math.min(count, 50);
    }

    for (let i = 0; i < count; i++) {
      this.particles.push({
        seed: Math.random(),
        baseX: Math.random() * 2000,
        baseY: Math.random() * 2000,
        vx: (Math.random() * 0.4 - 0.2) * (this.options.reduceMotion ? 0.2 : 1),
        vy: (Math.random() * 0.4 - 0.2) * (this.options.reduceMotion ? 0.2 : 1),
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.6 + 0.3,
        angle: Math.random() * Math.PI * 2,
        baseRadius: Math.random() * 300 + 40,
        orbitRadius: Math.random() * 150 + 20,
        planetIndex: Math.floor(Math.random() * 3),
        nodeIndex: Math.floor(Math.random() * 5),
        ringIndex: Math.floor(Math.random() * 4),
        clusterIndex: Math.floor(Math.random() * 6)
      });
    }
  }

  resolveColor(color) {
    if (!color) return "#000000";
    let resolved = String(color).trim();
    
    while (resolved.includes("var(")) {
      const match = resolved.match(/var\(([^)]+)\)/);
      if (match && match[1]) {
        const varName = match[1].trim();
        let computed = typeof window !== "undefined"
          ? window.getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
          : "";
        if (!computed) {
          computed = THEME_FALLBACKS[varName] || "";
        }
        if (computed) {
          resolved = computed;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return resolved;
  }

  blendColor(cssColor, targetAlpha) {
    if (!cssColor) return "rgba(0,0,0,0)";
    const color = this.resolveColor(cssColor);
    
    if (color.startsWith("rgba")) {
      return color.replace(/[\d.]+\)$/, `${targetAlpha})`);
    }
    if (color.startsWith("rgb")) {
      return color.replace("rgb", "rgba").replace(/\)$/, `, ${targetAlpha})`);
    }
    if (color.startsWith("color(srgb")) {
      if (color.includes("/")) {
        return color.replace(/\/ [\d.]+\)$/, `/ ${targetAlpha})`);
      } else {
        return color.replace(/\)$/, ` / ${targetAlpha})`);
      }
    }
    if (color.startsWith("#")) {
      const r = parseInt(color.slice(1, 3), 16) || 0;
      const g = parseInt(color.slice(3, 5), 16) || 0;
      const b = parseInt(color.slice(5, 7), 16) || 0;
      return `rgba(${r}, ${g}, ${b}, ${targetAlpha})`;
    }
    return color;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    this.tick(performance.now());
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  tick(timestamp) {
    if (!this.running) return;

    const delta = timestamp - this.lastFrameTime;
    const fpsLimit = this.options.batterySaver ? 33.3 : 16.6; // ~30fps vs ~60fps

    if (delta >= fpsLimit) {
      this.time += delta;
      this.lastFrameTime = timestamp;

      // Update transition progress
      if (this.state !== this.targetState) {
        const elapsed = timestamp - this.lastStateChange;
        const progress = Math.min(1.0, elapsed / this.transitionDuration);
        this.transitionProgress = this.options.reduceMotion ? 1.0 : progress;
        if (progress >= 1.0) {
          this.state = this.targetState;
        }
      }

      this.draw();
    }

    this.rafId = requestAnimationFrame((ts) => this.tick(ts));
  }

  getCoordinates(p, state, time, speedMultiplier) {
    const cx = this.width / 2;
    const cy = this.height / 2;

    switch (state) {
      case "enter-music-planet": {
        const maxRadius = Math.max(this.width, this.height) * 0.7;
        const progress = (p.seed * 1000 + time * 0.002) % 1.0;
        const d = progress * maxRadius;
        return {
          x: cx + Math.cos(p.angle) * d,
          y: cy + Math.sin(p.angle) * d,
          size: p.size * (0.5 + progress * 2.0),
          alpha: p.alpha * (1.0 - progress)
        };
      }

      case "library-galaxy": {
        const r = p.baseRadius * 0.75;
        const rotation = p.angle + time * (0.0001 + (120 / (r + 40)) * 0.0008) * speedMultiplier;
        const armOffset = p.clusterIndex % 2 === 0 ? 0 : Math.PI;
        const spiralAngle = rotation + r * 0.005 + armOffset;
        return {
          x: cx + Math.cos(spiralAngle) * r,
          y: cy + Math.sin(spiralAngle) * r * 0.38,
          size: p.size,
          alpha: p.alpha
        };
      }

      case "playlist-constellation": {
        const numClusters = 6;
        const clusters = [];
        const minDim = Math.min(this.width, this.height);
        for (let i = 0; i < numClusters; i++) {
          const clusterAngle = (i / numClusters) * Math.PI * 2;
          clusters.push({
            x: cx + Math.cos(clusterAngle) * (minDim * 0.28),
            y: cy + Math.sin(clusterAngle) * (minDim * 0.22)
          });
        }
        const cluster = clusters[p.clusterIndex % numClusters];
        const r = p.orbitRadius * 0.55;
        const theta = p.angle + time * 0.00025 * speedMultiplier;
        return {
          x: cluster.x + Math.cos(theta) * r,
          y: cluster.y + Math.sin(theta) * r,
          size: p.size,
          alpha: p.alpha * 0.8
        };
      }

      case "album-orbits": {
        const planets = [
          { x: cx - this.width * 0.22, y: cy + this.height * 0.04, r: 40 },
          { x: cx, y: cy - this.height * 0.08, r: 55 },
          { x: cx + this.width * 0.22, y: cy + this.height * 0.04, r: 45 }
        ];
        const planet = planets[p.planetIndex % planets.length];
        const r = planet.r + p.orbitRadius * 0.5;
        const theta = p.angle + time * 0.0004 * speedMultiplier;
        return {
          x: planet.x + Math.cos(theta) * r,
          y: planet.y + Math.sin(theta) * r * 0.45,
          size: p.size,
          alpha: p.alpha
        };
      }

      case "artist-stars": {
        const progress = (p.seed * 500 + time * 0.0008) % 1.0;
        const maxD = Math.min(this.width, this.height) * 0.42;
        const d = progress * maxD;
        return {
          x: cx + Math.cos(p.angle) * d,
          y: cy + Math.sin(p.angle) * d,
          size: p.size * (0.8 + (1.0 - progress) * 1.5),
          alpha: p.alpha * (1.0 - progress)
        };
      }

      case "now-playing-core": {
        const coreRadius = 80 + (this.audioData.bass * 25 * (this.options.intensity / 100));
        const r = coreRadius + p.orbitRadius * 0.75;
        const theta = p.angle + time * 0.0002 * speedMultiplier;
        return {
          x: cx + Math.cos(theta) * r,
          y: cy + Math.sin(theta) * r * 0.55,
          size: p.size,
          alpha: p.alpha
        };
      }

      case "lyrics-rings": {
        const ringIdx = p.ringIndex % 4;
        const baseR = 100 + ringIdx * 60;
        const theta = p.angle + time * 0.00015 * (1 + ringIdx * 0.3) * speedMultiplier;
        
        let ripple = 0;
        const audioVal = ringIdx === 0 ? this.audioData.bass : ringIdx === 1 ? this.audioData.mids : this.audioData.highs;
        ripple = Math.sin(theta * 6 + time * 0.004) * audioVal * 20 * (this.options.intensity / 100);
        
        const r = baseR + ripple;
        return {
          x: cx + Math.cos(theta) * r,
          y: cy + Math.sin(theta) * r * 0.65,
          size: p.size,
          alpha: p.alpha * 0.9
        };
      }

      case "queue-satellites": {
        const numSatellites = 5;
        const nodes = [];
        for (let i = 0; i < numSatellites; i++) {
          nodes.push({
            x: cx + (i - (numSatellites - 1) / 2) * (this.width * 0.16),
            y: cy + Math.sin(time * 0.0008 + i) * 20
          });
        }
        const node = nodes[p.nodeIndex % numSatellites];
        const r = 22 + p.orbitRadius * 0.25;
        const theta = p.angle + time * 0.0008 * speedMultiplier;
        return {
          x: node.x + Math.cos(theta) * r,
          y: node.y + Math.sin(theta) * r,
          size: p.size,
          alpha: p.alpha
        };
      }

      case "memory-trails":
      case "idle-space":
      default: {
        const factor = state === "memory-trails" ? 2.2 : 0.8;
        let x = (p.baseX + time * p.vx * factor * speedMultiplier) % this.width;
        let y = (p.baseY + time * p.vy * factor * speedMultiplier) % this.height;
        if (x < 0) x += this.width;
        if (y < 0) y += this.height;
        return {
          x,
          y,
          size: p.size,
          alpha: p.alpha
        };
      }
    }
  }

  draw() {
    // 1. Clear background
    const isTrailState = this.state === "memory-trails" || this.targetState === "memory-trails";
    
    if (isTrailState && !this.options.reduceMotion) {
      this.ctx.fillStyle = this.blendColor(this.palette.base, 0.09);
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else {
      this.ctx.clearRect(0, 0, this.width, this.height);
      
      // Draw background ambient radial glow
      const cx = this.width / 2;
      const cy = this.height / 2;
      const gradient = this.ctx.createRadialGradient(
        cx, cy, 10,
        cx, cy, Math.max(this.width, this.height) * 0.75
      );
      
      const bassPulse = 1.0 + this.audioData.bass * 0.12 * (this.options.intensity / 100);
      gradient.addColorStop(0, this.blendColor(this.palette.primary, 0.16 * bassPulse));
      gradient.addColorStop(0.5, this.blendColor(this.palette.spectral, 0.06));
      gradient.addColorStop(1.0, this.resolveColor(this.palette.base));
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    if (this.options.staticBg) return;

    // 2. Draw static decorations (planets/moons/rings in specific states)
    this.drawStateDecorations();

    // 3. Render Particles
    const cx = this.width / 2;
    const cy = this.height / 2;
    const speedMultiplier = this.audioData.energy > 0 ? (1.0 + this.audioData.energy * 0.6) : 0.25;

    this.ctx.save();
    
    // Slight camera rotate or shift based on scroll progress
    if (this.scrollProgress !== 0 && !this.options.reduceMotion) {
      this.ctx.translate(cx, cy);
      this.ctx.rotate(this.scrollProgress * 0.05);
      this.ctx.translate(-cx, -cy);
    }

    const t = this.options.reduceMotion ? 1.0 : this.transitionProgress;
    const easedT = t * t * (3.0 - 2.0 * t); // smooth cubic ease

    // Render particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      
      const coord1 = this.getCoordinates(p, this.state, this.time, speedMultiplier);
      const coord2 = this.state === this.targetState 
        ? coord1 
        : this.getCoordinates(p, this.targetState, this.time, speedMultiplier);

      const x = coord1.x * (1 - easedT) + coord2.x * easedT;
      const y = coord1.y * (1 - easedT) + coord2.y * easedT;
      const size = coord1.size * (1 - easedT) + coord2.size * easedT;
      const alpha = coord1.alpha * (1 - easedT) + coord2.alpha * easedT;

      this.ctx.fillStyle = this.resolveColor(this.palette.spectral);
      this.ctx.globalAlpha = alpha;
      this.ctx.beginPath();
      this.ctx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 4. Draw constellation link lines
    if (this.state === "playlist-constellation" || this.targetState === "playlist-constellation") {
      this.drawConstellationLines(easedT);
    }

    this.ctx.restore();
  }

  drawConstellationLines(easedT) {
    const threshold = 70;
    const maxLines = 80;
    let linesDrawn = 0;
    const activeAlpha = this.state === "playlist-constellation" ? (1 - easedT) : easedT;
    if (activeAlpha <= 0.05) return;

    this.ctx.strokeStyle = this.resolveColor(this.palette.spectral);
    this.ctx.lineWidth = 0.5;

    const speedMultiplier = this.audioData.energy > 0 ? (1.0 + this.audioData.energy * 0.6) : 0.25;

    for (let i = 0; i < this.particles.length; i += 2) {
      if (linesDrawn >= maxLines) break;
      const p1 = this.particles[i];
      const coord1A = this.getCoordinates(p1, this.state, this.time, speedMultiplier);
      const coord1B = this.state === this.targetState 
        ? coord1A 
        : this.getCoordinates(p1, this.targetState, this.time, speedMultiplier);
      const x1 = coord1A.x * (1 - easedT) + coord1B.x * easedT;
      const y1 = coord1A.y * (1 - easedT) + coord1B.y * easedT;

      for (let j = i + 1; j < this.particles.length; j += 3) {
        const p2 = this.particles[j];
        const coord2A = this.getCoordinates(p2, this.state, this.time, speedMultiplier);
        const coord2B = this.state === this.targetState 
          ? coord2A 
          : this.getCoordinates(p2, this.targetState, this.time, speedMultiplier);
        const x2 = coord2A.x * (1 - easedT) + coord2B.x * easedT;
        const y2 = coord2A.y * (1 - easedT) + coord2B.y * easedT;

        const dx = x1 - x2;
        const dy = y1 - y2;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < threshold) {
          const lineAlpha = (1.0 - dist / threshold) * 0.15 * activeAlpha;
          this.ctx.globalAlpha = lineAlpha;
          this.ctx.beginPath();
          this.ctx.moveTo(x1, y1);
          this.ctx.lineTo(x2, y2);
          this.ctx.stroke();
          linesDrawn++;
          if (linesDrawn >= maxLines) break;
        }
      }
    }
  }

  drawStateDecorations() {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const intensityFactor = this.options.intensity / 100;

    const t = this.options.reduceMotion ? 1.0 : this.transitionProgress;
    const easedT = t * t * (3.0 - 2.0 * t);

    // Helper to blend opacity of decorations based on state activity
    const getActiveOpacity = (stateName) => {
      let opacity = 0;
      if (this.state === stateName) opacity += 1 - easedT;
      if (this.targetState === stateName) opacity += easedT;
      return Math.min(1.0, opacity);
    };

    // 1. Draw central Glowing Core in "now-playing-core"
    const coreOpacity = getActiveOpacity("now-playing-core");
    if (coreOpacity > 0.02) {
      const baseRadius = 80;
      const bassVal = this.audioData.bass * 25 * intensityFactor;
      const r = baseRadius + bassVal;
      
      this.ctx.save();
      this.ctx.globalAlpha = coreOpacity * 0.3;
      
      // Outer radial glow
      const glowGrad = this.ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 2.2);
      glowGrad.addColorStop(0, this.resolveColor(this.palette.primary));
      glowGrad.addColorStop(0.4, this.resolveColor(this.palette.spectral));
      glowGrad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
      
      this.ctx.fillStyle = glowGrad;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
      this.ctx.fill();

      // Main sphere
      this.ctx.globalAlpha = coreOpacity * 0.85;
      const sphereGrad = this.ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      sphereGrad.addColorStop(0, this.resolveColor(this.palette.spectral));
      sphereGrad.addColorStop(1, this.resolveColor(this.palette.primary));
      this.ctx.fillStyle = sphereGrad;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.fill();

      // Flat Orbit Ring line
      this.ctx.globalAlpha = coreOpacity * 0.2;
      this.ctx.strokeStyle = this.resolveColor(this.palette.spectral);
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.ellipse(cx, cy, r * 1.5, r * 0.8, 0, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.restore();
    }

    // 2. Draw central star in "artist-stars"
    const starOpacity = getActiveOpacity("artist-stars");
    if (starOpacity > 0.02) {
      const starR = 25 + this.audioData.bass * 15 * intensityFactor;
      this.ctx.save();
      this.ctx.globalAlpha = starOpacity * 0.25;
      
      const starGlow = this.ctx.createRadialGradient(cx, cy, starR * 0.2, cx, cy, starR * 4);
      starGlow.addColorStop(0, "#ffffff");
      starGlow.addColorStop(0.3, this.resolveColor(this.palette.spectral));
      starGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      this.ctx.fillStyle = starGlow;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, starR * 4, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.globalAlpha = starOpacity * 0.9;
      this.ctx.fillStyle = "#ffffff";
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, starR, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // 3. Draw album planets in "album-orbits"
    const albumOpacity = getActiveOpacity("album-orbits");
    if (albumOpacity > 0.02) {
      const planets = [
        { x: cx - this.width * 0.22, y: cy + this.height * 0.04, r: 40, col: this.resolveColor(this.palette.primary) },
        { x: cx, y: cy - this.height * 0.08, r: 55, col: this.resolveColor(this.palette.spectral) },
        { x: cx + this.width * 0.22, y: cy + this.height * 0.04, r: 45, col: this.resolveColor(this.palette.primary) }
      ];

      this.ctx.save();
      this.ctx.globalAlpha = albumOpacity;

      planets.forEach((p) => {
        // Draw orbital ring ellipse
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.ellipse(p.x, p.y, p.r * 1.5, p.r * 0.6, Math.PI * 0.05, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw planet soft back glow
        const glow = this.ctx.createRadialGradient(p.x, p.y, p.r * 0.1, p.x, p.y, p.r * 1.8);
        glow.addColorStop(0, p.col);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        this.ctx.fillStyle = glow;
        this.ctx.globalAlpha = albumOpacity * 0.35;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.r * 1.8, 0, Math.PI * 2);
        this.ctx.fill();

        // Planet body
        this.ctx.globalAlpha = albumOpacity * 0.75;
        const grad = this.ctx.createLinearGradient(p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r);
        grad.addColorStop(0, p.col);
        grad.addColorStop(1, "#09090e");
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        this.ctx.fill();
      });

      this.ctx.restore();
    }

    // 4. Draw lyric concentric orbit rings in "lyrics-rings"
    const lyricsOpacity = getActiveOpacity("lyrics-rings");
    if (lyricsOpacity > 0.02) {
      this.ctx.save();
      this.ctx.globalAlpha = lyricsOpacity * 0.08;
      this.ctx.strokeStyle = this.resolveColor(this.palette.spectral);
      this.ctx.lineWidth = 1.0;

      for (let i = 0; i < 4; i++) {
        const ringRadius = 100 + i * 60;
        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy, ringRadius, ringRadius * 0.65, 0, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // 5. Draw satellite nodes in "queue-satellites"
    const queueOpacity = getActiveOpacity("queue-satellites");
    if (queueOpacity > 0.02) {
      const numSatellites = 5;
      this.ctx.save();
      this.ctx.globalAlpha = queueOpacity * 0.4;
      this.ctx.fillStyle = this.resolveColor(this.palette.primary);

      for (let i = 0; i < numSatellites; i++) {
        const nodeX = cx + (i - (numSatellites - 1) / 2) * (this.width * 0.16);
        const nodeY = cy + Math.sin(this.time * 0.0008 + i) * 20;

        // Faint ring
        this.ctx.strokeStyle = "rgba(255,255,255,0.04)";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(nodeX, nodeY, 25, 0, Math.PI * 2);
        this.ctx.stroke();

        // Node center
        this.ctx.beginPath();
        this.ctx.arc(nodeX, nodeY, 4, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }
  }
}

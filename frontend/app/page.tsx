'use client';

import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';

const FluidBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const targetRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vert = `
      attribute vec2 a_pos;
      void main() { gl_Position = vec4(a_pos, 0, 1); }
    `;

    const frag = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_res;
      uniform vec2 u_mouse;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        vec2 shift = vec2(100.0);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p * 2.0 + shift;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_res;
        float aspect = u_res.x / u_res.y;
        vec2 p = uv;
        p.x *= aspect;

        float t = u_time * 0.04;

        vec2 m = u_mouse;
        m.x *= aspect;
        vec2 mOff = (m - vec2(0.5 * aspect, 0.5)) * 0.25;

        // Domain warping — 0.4 frequency for large shapes
        vec2 q = vec2(
          fbm(p * 0.4 + t * 0.3 + mOff * 0.5),
          fbm(p * 0.4 + vec2(5.2, 1.3) - t * 0.25 + mOff.yx * 0.4)
        );

        // Second warp layer — multiplier 3.0 for visible but not chaotic warping
        vec2 r = vec2(
          fbm(p * 0.4 + 3.0 * q + vec2(1.7, 9.2) + t * 0.2 + mOff * 0.3),
          fbm(p * 0.4 + 3.0 * q + vec2(8.3, 2.8) - t * 0.15 - mOff.yx * 0.2)
        );

        float f = fbm(p * 0.4 + 3.0 * r);

        // === COLOR MAPPING ===
        // f ranges roughly 0.15 to 0.75 with this config
        // Color appears in 0.30-0.65 band, rest is black
        
        vec3 black      = vec3(0.0);
        vec3 deepBlue   = vec3(0.04, 0.10, 0.40);
        vec3 skyBlue    = vec3(0.22, 0.52, 0.82);
        vec3 paleCyan   = vec3(0.50, 0.75, 0.92);
        vec3 deepOrange = vec3(0.72, 0.22, 0.02);
        vec3 brightOrng = vec3(0.95, 0.42, 0.05);

        vec3 color = black;

        // Gradual color transitions
        color = mix(color, deepBlue,   smoothstep(0.28, 0.34, f));
        color = mix(color, skyBlue,    smoothstep(0.32, 0.39, f));
        color = mix(color, paleCyan,   smoothstep(0.37, 0.43, f));
        color = mix(color, deepOrange, smoothstep(0.42, 0.50, f));
        color = mix(color, brightOrng, smoothstep(0.48, 0.58, f));
        // Fade back toward dark at high values
        color = mix(color, deepOrange * 0.5, smoothstep(0.60, 0.70, f));
        color = mix(color, black,      smoothstep(0.72, 0.85, f));

        // Contrast
        color *= 1.15;
        color = clamp(color, 0.0, 1.0);

        // Film grain
        float grain = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.08;
        color += grain;
        color = clamp(color, 0.0, 1.0);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    function mkShader(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) { console.error(gl!.getShaderInfoLog(s)); return null; }
      return s;
    }
    const vs = mkShader(gl.VERTEX_SHADER, vert);
    const fs = mkShader(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px'; canvas.style.height = window.innerHeight + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize(); window.addEventListener('resize', resize);
    const onMouse = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX / window.innerWidth, y: 1.0 - e.clientY / window.innerHeight };
    };
    window.addEventListener('mousemove', onMouse);
    const t0 = performance.now();
    const loop = () => {
      mouseRef.current.x += (targetRef.current.x - mouseRef.current.x) * 0.008;
      mouseRef.current.y += (targetRef.current.y - mouseRef.current.y) * 0.008;
      gl.uniform1f(uTime, (performance.now() - t0) / 1000);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onMouse); };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 z-0" style={{ width: '100%', height: '100%' }} />
      <div className="fixed inset-0 z-[1] pointer-events-none opacity-[0.25] mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '180px 180px' }} />
    </>
  );
};

const CustomCursor = () => {
  const cx = useSpring(0, { stiffness: 300, damping: 28 }); const cy = useSpring(0, { stiffness: 300, damping: 28 });
  const rx = useSpring(0, { stiffness: 80, damping: 20 }); const ry = useSpring(0, { stiffness: 80, damping: 20 });
  useEffect(() => {
    const mv = (e: MouseEvent) => { cx.set(e.clientX); cy.set(e.clientY); rx.set(e.clientX); ry.set(e.clientY); };
    window.addEventListener('mousemove', mv); return () => window.removeEventListener('mousemove', mv);
  }, [cx, cy, rx, ry]);
  return (<>
    <motion.div style={{ x: cx, y: cy, translateX: '-50%', translateY: '-50%' }} className="fixed top-0 left-0 z-[200] pointer-events-none hidden md:block w-2 h-2 rounded-full bg-white mix-blend-difference" />
    <motion.div style={{ x: rx, y: ry, translateX: '-50%', translateY: '-50%' }} className="fixed top-0 left-0 z-[199] pointer-events-none hidden md:block w-10 h-10 rounded-full border border-white/30 mix-blend-difference" />
  </>);
};

const FadeUp = ({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null); const inView = useInView(ref, { once: true, margin: '-80px' });
  return (<motion.div ref={ref} className={className} initial={{ opacity: 0, y: 50 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>);
};
const FadeIn = ({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const ref = useRef(null); const inView = useInView(ref, { once: true, margin: '-60px' });
  return (<motion.div ref={ref} className={className} initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 1.2, delay, ease: 'easeOut' }}>{children}</motion.div>);
};

const LiveClock = () => {
  const [time, setTime] = useState('');
  useEffect(() => { const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })); tick(); const id = setInterval(tick, 1000); return () => clearInterval(id); }, []);
  return <span>{time}</span>;
};

const FeatureRow = ({ num, title, subtitle, desc, delay }: { num: string; title: string; subtitle: string; desc: string; delay: number }) => (
  <FadeUp delay={delay}>
    <div className="group flex flex-col md:flex-row justify-between items-start md:items-center py-10 md:py-14 border-b border-white/[0.08] hover:border-white/25 transition-all duration-500 cursor-pointer">
      <div className="flex items-start gap-6 md:gap-10">
        <span className="text-[11px] font-mono text-white/30 mt-2 tabular-nums">{num}</span>
        <div className="flex flex-col gap-1">
          <h3 className="text-3xl md:text-5xl font-light tracking-tight text-white/90 group-hover:text-white transition-colors duration-500">{title}</h3>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-medium">{subtitle}</span>
        </div>
      </div>
      <div className="mt-4 md:mt-0 max-w-sm text-[15px] text-white/50 leading-relaxed group-hover:text-white/70 transition-colors duration-500 md:text-right">{desc}</div>
    </div>
  </FadeUp>
);

const StatBlock = ({ value, label, delay }: { value: string; label: string; delay: number }) => (
  <FadeUp delay={delay} className="flex flex-col items-center text-center">
    <span className="text-5xl md:text-6xl font-extralight tracking-tighter text-white/90">{value}</span>
    <span className="text-[11px] uppercase tracking-[0.2em] text-white/40 mt-3">{label}</span>
  </FadeUp>
);

export default function SchedulaLanding() {
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.97]);

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-black text-neutral-900 dark:text-neutral-100 font-sans selection:bg-black/20 dark:selection:bg-white/20 overflow-x-hidden cursor-none">
      <FluidBackground />
      <CustomCursor />

      <nav className="fixed top-0 left-0 right-0 z-[100] px-6 md:px-10 py-5">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-0.5">
            <Link href="/" className="text-black dark:text-white text-base font-semibold tracking-tight mb-2 hover:opacity-70 transition-opacity">Schedula</Link>
            <div className="flex flex-col text-[10px] uppercase tracking-[0.18em] font-medium text-neutral-500 dark:text-neutral-400">
              <Link href="#features" className="hover:text-black dark:hover:text-white/80 transition-colors py-0.5">Features</Link>
              <Link href="#intelligence" className="hover:text-black dark:hover:text-white/80 transition-colors py-0.5">Intelligence</Link>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-center text-[10px] uppercase tracking-[0.18em] font-medium text-neutral-500 dark:text-neutral-400">
            <Link href="#about" className="hover:text-black dark:hover:text-white/80 transition-colors py-0.5">About</Link>
            <Link href="#stats" className="hover:text-black dark:hover:text-white/80 transition-colors py-0.5">Impact</Link>
          </div>
          <div className="flex flex-col items-end text-[10px] uppercase tracking-[0.18em] font-medium text-neutral-500 dark:text-neutral-400">
            <span className="text-neutral-800 dark:text-white/70 mb-2 tabular-nums"><LiveClock /></span>
            <span>Penn State</span><span>University Park</span>
          </div>
        </div>
      </nav>

      <motion.section style={{ opacity: heroOpacity, scale: heroScale }} className="relative z-10 h-screen flex flex-col justify-center items-center text-center px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }} className="mix-blend-difference">
          <h1 className="text-[11vw] md:text-[8.5vw] leading-[0.92] font-light tracking-[-0.03em] text-white">
            We are an intelligent<br />platform<br /><span className="italic font-extralight opacity-80">of course planning</span>
          </h1>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.2 }} className="absolute bottom-8 left-6 md:left-10 flex flex-col text-[10px] uppercase tracking-[0.2em] font-medium text-white/50 mix-blend-difference">
          <span>Based in Pennsylvania</span><span>Born for Students</span>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.2 }} className="absolute bottom-8 right-6 md:right-10 flex flex-col items-end text-[10px] uppercase tracking-[0.2em] font-medium text-white/50 mix-blend-difference">
          <span>AI-Driven</span><span>Conflict-Free</span>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.5 }} className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center mix-blend-difference">
          <span className="text-[10px] uppercase tracking-[0.25em] font-medium text-white/30 mb-4">Scroll</span>
          <motion.div animate={{ height: ['24px', '48px', '24px'] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} className="w-px bg-white/25" />
        </motion.div>
      </motion.section>

      <section className="relative z-10 py-28 md:py-40 px-6 md:px-10">
        <div className="max-w-5xl mx-auto"><FadeUp><p className="text-2xl md:text-4xl font-light leading-[1.4] tracking-tight text-neutral-600 dark:text-neutral-300">Every semester, 40,000 Penn State students fight the same broken system. Closed sections. Conflicting schedules. Professors you&apos;ve never heard of. Degree requirements that read like tax code.<span className="text-black dark:text-white font-normal"> Schedula replaces the chaos with clarity.</span></p></FadeUp></div>
      </section>

      <section id="stats" className="relative z-10 py-20 px-6 md:px-10">
        <div className="max-w-6xl mx-auto"><div className="border-t border-b border-black/10 dark:border-white/[0.06] py-16 grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6">
          <StatBlock value="500+" label="Courses Indexed" delay={0} />
          <StatBlock value="<1s" label="Search Results" delay={0.1} />
          <StatBlock value="98%" label="Schedule Accuracy" delay={0.2} />
          <StatBlock value="0" label="Time Conflicts" delay={0.3} />
        </div></div>
      </section>

      <section id="features" className="relative z-10 py-20 md:py-32 px-6 md:px-10">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="flex justify-between items-end border-b border-black/10 dark:border-white/[0.1] pb-4 mb-4">
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-neutral-500 dark:text-neutral-400">Platform</span>
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-neutral-500 dark:text-neutral-400">What we built ↗</span>
          </FadeIn>
          <FeatureRow num="01" title="Instant Search" subtitle="Natural Language" desc="Type how you think. 'Easy science elective MWF mornings' returns exactly what you need. No course codes required." delay={0.05} />
          <FeatureRow num="02" title="Professor Intelligence" subtitle="Student Reviews + Data" desc="Aggregated ratings, grade distributions, teaching style breakdowns. Know exactly who you're signing up for." delay={0.1} />
          <FeatureRow num="03" title="Conflict Prevention" subtitle="Visual Schedule Builder" desc="Drag-and-drop your semester. Instant overlap detection, credit tracking, and one-click export to Google Calendar." delay={0.15} />
          <FeatureRow num="04" title="Degree Mapping" subtitle="Graduation Pathing" desc="See every requirement you need to graduate. Track your progress. Never miss a prerequisite chain again." delay={0.2} />
          <FeatureRow num="05" title="Workload Balancing" subtitle="AI Analysis" desc="Our model analyzes historical difficulty data so you never accidentally stack four exam-heavy courses in one semester." delay={0.25} />
        </div>
      </section>

      <section id="intelligence" className="relative z-10 py-28 md:py-40 px-6 md:px-10">
        <div className="max-w-5xl mx-auto">
          <FadeUp><span className="text-[10px] uppercase tracking-[0.25em] font-medium text-neutral-500 dark:text-neutral-400 mb-8 block">Intelligence</span></FadeUp>
          <FadeUp delay={0.1}><h2 className="text-4xl md:text-6xl font-light tracking-tight leading-[1.1] text-black dark:text-white/90 mb-10">The engine behind<br /><span className="italic font-extralight text-neutral-600 dark:text-neutral-400">smarter decisions</span></h2></FadeUp>
          <div className="grid md:grid-cols-2 gap-16">
            <FadeUp delay={0.15}><div className="space-y-6">
              <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed font-light">Schedula&apos;s recommendation engine is trained on semesters of real enrollment data. It understands which courses pair well, which professors match your learning style, and which combinations set students up for success.</p>
              <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed font-light">Think of it as having a senior who&apos;s been through every possible schedule sitting next to you during registration.</p>
            </div></FadeUp>
            <FadeUp delay={0.25}><div className="space-y-5">
              {[{label:'Collaborative Filtering',desc:'Students who took X also succeeded in Y'},{label:'NLP Review Analysis',desc:'Sentiment scoring across thousands of reviews'},{label:'Difficulty Prediction',desc:'Estimated workload before you commit'},{label:'Prerequisite Mapping',desc:'Never get locked out of a required class'}].map((item,i)=>(
                <div key={i} className="flex items-start gap-4 group"><div className="w-1.5 h-1.5 rounded-full bg-black/20 dark:bg-white/20 mt-2.5 group-hover:bg-black/60 dark:group-hover:bg-white/60 transition-colors"/><div><span className="text-black dark:text-white/80 text-sm font-medium block">{item.label}</span><span className="text-neutral-500 dark:text-neutral-400 text-sm">{item.desc}</span></div></div>
              ))}
            </div></FadeUp>
          </div>
        </div>
      </section>

      <section id="about" className="relative z-10 py-28 md:py-40 px-6 md:px-10">
        <div className="max-w-5xl mx-auto">
          <FadeUp><span className="text-[10px] uppercase tracking-[0.25em] font-medium text-neutral-500 dark:text-neutral-400 mb-8 block">Why this exists</span></FadeUp>
          <FadeUp delay={0.1}><p className="text-2xl md:text-4xl font-light leading-[1.4] tracking-tight text-neutral-600 dark:text-neutral-400">We built Schedula because we were tired of opening LionPATH at 6 AM and praying our schedule worked.<span className="text-black dark:text-white/90"> The university gives you a system built in 2005. We built the one you actually deserve.</span></p></FadeUp>
          <FadeUp delay={0.2}><div className="flex flex-wrap gap-3 mt-12">{['Next.js','FastAPI','PostgreSQL','scikit-learn','Transformers','Three.js'].map(t=>(<span key={t} className="px-4 py-2 rounded-full border border-black/10 dark:border-white/[0.06] text-[11px] uppercase tracking-[0.15em] text-neutral-600 dark:text-neutral-400 font-medium hover:text-black dark:hover:text-white/60 hover:border-black/30 dark:hover:border-white/15 transition-all">{t}</span>))}</div></FadeUp>
        </div>
      </section>

      <section className="relative z-10 py-32 md:py-48 px-6 text-center">
        <FadeUp><h2 className="text-5xl md:text-[7vw] font-light tracking-tight leading-[0.95] text-black dark:text-white mb-12 mix-blend-difference">Registration opens soon.<br /><span className="italic font-extralight text-neutral-600 dark:text-neutral-400">Be ready.</span></h2></FadeUp>
        <FadeUp delay={0.15}><Link href="/courses" className="inline-flex items-center gap-3 px-10 py-5 bg-black dark:bg-white text-white dark:text-black text-sm uppercase tracking-[0.15em] font-semibold rounded-full hover:scale-105 active:scale-95 transition-transform shadow-[0_0_60px_rgba(0,0,0,0.15)] dark:shadow-[0_0_60px_rgba(255,255,255,0.15)] hover:shadow-[0_0_80px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_0_80px_rgba(255,255,255,0.25)]">Start Planning<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></Link></FadeUp>
        <FadeUp delay={0.25}><p className="text-sm text-neutral-500 dark:text-neutral-400 mt-8 font-light">Free for all Penn State students. No credit card.</p></FadeUp>
      </section>

      <footer className="relative z-10 border-t border-black/5 dark:border-white/[0.05] bg-zinc-50 dark:bg-black px-6 md:px-10 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-neutral-400 dark:text-neutral-500">© 2026 Schedula</span>
          <div className="flex gap-8 text-[10px] uppercase tracking-[0.2em] font-medium text-neutral-400 dark:text-neutral-500">
            <Link href="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-black dark:hover:text-white transition-colors">Terms</Link>
            <a href="mailto:team@schedula.app" className="hover:text-black dark:hover:text-white transition-colors">Contact</a>
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-neutral-400 dark:text-neutral-500">Built by students, for students</span>
        </div>
      </footer>
    </div>
  );
}
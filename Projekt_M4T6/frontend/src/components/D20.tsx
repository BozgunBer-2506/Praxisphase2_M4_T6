"use client";

import { useRef, useEffect, useCallback, useState } from "react";

const PHI = (1 + Math.sqrt(5)) / 2;
const NORM = Math.sqrt(1 + PHI * PHI);
type V3 = [number, number, number];

const VERTS: V3[] = [
  [-1,PHI,0],[1,PHI,0],[-1,-PHI,0],[1,-PHI,0],
  [0,-1,PHI],[0,1,PHI],[0,-1,-PHI],[0,1,-PHI],
  [PHI,0,-1],[PHI,0,1],[-PHI,0,-1],[-PHI,0,1],
].map(v => [v[0]/NORM, v[1]/NORM, v[2]/NORM]);

const FACES = [
  [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
  [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
  [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
  [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
];
const NUMS = [20,2,14,8,6,16,18,4,12,10,1,19,7,13,3,17,11,5,15,9];
const RX = 0.28;
const LIGHT: V3 = (() => {
  const l: V3 = [0.45,0.85,0.65];
  const n = Math.sqrt(l[0]**2+l[1]**2+l[2]**2);
  return [l[0]/n,l[1]/n,l[2]/n];
})();

const sub   = (a:V3,b:V3):V3 => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross = (a:V3,b:V3):V3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot   = (a:V3,b:V3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const nrm   = (v:V3):V3 => { const l=Math.sqrt(v[0]**2+v[1]**2+v[2]**2); return [v[0]/l,v[1]/l,v[2]/l]; };

function rotate(v:V3, ry:number, rx:number):V3 {
  let [x,y,z] = v;
  const cy=Math.cos(ry), sy=Math.sin(ry); [x,z]=[x*cy+z*sy,-x*sy+z*cy];
  const cx=Math.cos(rx), sx=Math.sin(rx); [y,z]=[y*cx-z*sx,y*sx+z*cx];
  return [x,y,z];
}
function proj(v:V3, S:number, cx:number, cy:number):[number,number,number] {
  const f = 5/(5+v[2]*0.22);
  return [cx+v[0]*S*f, cy-v[1]*S*f, v[2]];
}

// Precompute ry angle that brings each face to face the camera.
// Rotation order in render is: RY first, then RX.
// z_final = y*sin(RX) + (-x*sin(ry) + z*cos(ry))*cos(RX)
// Maximise over ry: d/dRY = 0  =>  tan(ry) = -x/z  =>  ry = atan2(-x, z)
function faceCameraRy(faceIdx: number): number {
  const [i0,i1,i2] = FACES[faceIdx];
  const n = nrm(cross(sub(VERTS[i1], VERTS[i0]), sub(VERTS[i2], VERTS[i0])));
  return Math.atan2(-n[0], n[2]);
}
const FACE_ANGLES = FACES.map((_,i) => faceCameraRy(i));

function ryForNumber(num: number): number {
  const idx = NUMS.indexOf(num);
  return idx >= 0 ? FACE_ANGLES[idx] : FACE_ANGLES[0];
}

function easeOut(t: number): number {
  return 1 - Math.pow(1-t, 3);
}

type Particle = { x:number; y:number; vx:number; vy:number; life:number; maxLife:number; size:number; blue:boolean };

export default function D20({
  onRoll,
  currentValue,
  rollTrigger,
  targetValue,
}: {
  onRoll: (v:number) => void;
  currentValue: number|null;
  rollTrigger?: number;
  targetValue?: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ryRef    = useRef(ryForNumber(20));
  const targetNumRef = useRef<number>(20);
  const animRef  = useRef<{startRy:number; endRy:number; elapsed:number; dur:number; target:number} | null>(null);
  const particles = useRef<Particle[]>([]);
  const pulseRef  = useRef(0);
  const raf       = useRef<number>(0);
  const busyRef   = useRef(false);
  const lastTrigger = useRef<number | undefined>(rollTrigger);
  const targetValueRef = useRef<number | null | undefined>(targetValue);
  const [lastRoll, setLastRoll] = useState<number|null>(currentValue);

  useEffect(() => { targetValueRef.current = targetValue; }, [targetValue]);

  const spawnBurst = useCallback((cx:number, cy:number, S:number) => {
    for(let i=0;i<22;i++){
      const angle = Math.random()*Math.PI*2;
      const r = S*(0.2+Math.random()*0.7);
      particles.current.push({
        x: cx+Math.cos(angle)*r, y: cy+Math.sin(angle)*r,
        vx:(Math.random()-0.5)*1.2, vy:-(0.5+Math.random()*1.8),
        life:1, maxLife:0.7+Math.random()*1.0,
        size:1.5+Math.random()*2.8,
        blue: Math.random()<0.65,
      });
    }
  }, []);

  const startRoll = useCallback(() => {
    if(busyRef.current) return;
    busyRef.current = true;
    const pending = targetValueRef.current;
    targetValueRef.current = null;
    const val = (pending !== null && pending !== undefined) ? pending : Math.floor(Math.random()*20)+1;
    const targetRy = ryForNumber(val);
    // Spin 3-4 full rotations before landing
    const spins = 3 + Math.random();
    const endRy = ryRef.current + spins*Math.PI*2 + (targetRy - ((ryRef.current + spins*Math.PI*2) % (Math.PI*2) + Math.PI*2) % (Math.PI*2));
    // Simpler: just add rotations and offset
    const currentNorm = ((ryRef.current % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
    const targetNorm  = ((targetRy   % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
    let delta = targetNorm - currentNorm;
    if(delta < 0) delta += Math.PI*2;
    const end = ryRef.current + spins*Math.PI*2 + delta;

    const canvas = canvasRef.current;
    if(canvas){
      const DPR = window.devicePixelRatio||1;
      const W = canvas.width/DPR, H = canvas.height/DPR;
      spawnBurst(W/2, H/2-8, W*0.31);
    }

    targetNumRef.current = -1; // clear result during spin
    animRef.current = { startRy: ryRef.current, endRy: end, elapsed:0, dur:1.8, target:val };
    setTimeout(()=>{
      busyRef.current = false;
      setLastRoll(val);
      onRoll(val);
    }, 1900);
  }, [onRoll, spawnBurst]);

  // React to external rollTrigger prop
  useEffect(()=>{
    if(rollTrigger !== undefined && rollTrigger !== lastTrigger.current){
      lastTrigger.current = rollTrigger;
      startRoll();
    }
  }, [rollTrigger, startRoll]);

  const draw = useCallback((dt:number) => {
    const canvas = canvasRef.current; if(!canvas) return;
    const ctx = canvas.getContext("2d"); if(!ctx) return;
    const DPR = window.devicePixelRatio||1;
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const CX=W/2, CY=H/2-8, S=W*0.31;

    pulseRef.current += dt;
    const pulse = pulseRef.current;

    // Update anim
    const anim = animRef.current;
    if(anim){
      anim.elapsed += dt;
      const t = Math.min(anim.elapsed / anim.dur, 1);
      ryRef.current = anim.startRy + (anim.endRy - anim.startRy) * easeOut(t);
      if(t >= 1){ targetNumRef.current = anim.target; animRef.current = null; }
    }

    ctx.clearRect(0,0,canvas.width,canvas.height);

    const isAnimating = !!anim;

    // Outer magical aura — pulses gently
    const auraR = S*1.0 + Math.sin(pulse*1.7)*S*0.04;
    const auraAlpha = isAnimating ? 0.14 : 0.06;
    const auraGrad = ctx.createRadialGradient(CX,CY,S*0.4,CX,CY,auraR*1.35);
    auraGrad.addColorStop(0, `rgba(80,140,255,${auraAlpha+Math.sin(pulse*2.1)*0.02})`);
    auraGrad.addColorStop(0.55, `rgba(120,70,255,${auraAlpha*0.6})`);
    auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle=auraGrad; ctx.beginPath(); ctx.arc(CX,CY,auraR*1.4,0,Math.PI*2); ctx.fill();

    // Rune ground shadow
    const runeY = CY+S*0.82;
    ctx.save(); ctx.translate(CX,runeY); ctx.scale(1,0.2);
    [1.0,0.78,0.58].forEach((r,i)=>{
      ctx.shadowBlur=10*DPR; ctx.shadowColor=`rgba(100,150,255,${[0.22,0.15,0.08][i]})`;
      ctx.beginPath(); ctx.arc(0,0,S*r,0,Math.PI*2);
      ctx.strokeStyle=`rgba(100,160,255,${[0.28,0.18,0.10][i]})`; ctx.lineWidth=1.6*DPR; ctx.stroke();
    });
    // Rune glyphs
    const glyphs = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ'];
    ctx.shadowBlur=5*DPR; ctx.shadowColor='rgba(140,100,255,0.8)';
    ctx.fillStyle=`rgba(160,120,255,${0.4+Math.sin(pulse*1.3)*0.12})`;
    const gSize = Math.round(S*0.115*DPR);
    ctx.font=`${gSize}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    const runeSpeed = isAnimating ? pulse*2.2 : pulse*0.4;
    for(let i=0;i<8;i++){
      const a = runeSpeed + i*(Math.PI*2/8);
      ctx.save(); ctx.rotate(a); ctx.scale(1,1/0.2);
      ctx.fillText(glyphs[i], S*0.88, 0); ctx.restore();
    }
    ctx.shadowBlur=0; ctx.restore();

    const ry = ryRef.current;
    const vp = VERTS.map(v=>{ const r=rotate(v,ry,RX); return {r,p:proj(r,S,CX,CY)}; });

    const faces = FACES.map((f,i)=>{
      const [r0,r1,r2] = [vp[f[0]].r,vp[f[1]].r,vp[f[2]].r];
      const [p0,p1,p2] = [vp[f[0]].p,vp[f[1]].p,vp[f[2]].p];
      const n = nrm(cross(sub(r1,r0),sub(r2,r0)));
      const camDot=n[2], lightDot=Math.max(0,dot(n,LIGHT));
      const zMid=(p0[2]+p1[2]+p2[2])/3;
      const cxF=(p0[0]+p1[0]+p2[0])/3, cyF=(p0[1]+p1[1]+p2[1])/3;
      return {p0,p1,p2,camDot,lightDot,zMid,cxF,cyF,num:NUMS[i]};
    }).sort((a,b)=>a.zMid-b.zMid);

    for(const f of faces){
      if(f.camDot<0.02) continue;
      const {p0,p1,p2,lightDot:t,cxF,cyF,num,camDot} = f;

      // Deep metallic fill
      const d = 0.05+t*0.22;
      const bR=Math.round(4+d*22), bG=Math.round(6+d*20), bB=Math.round(22+d*58);
      const spec = Math.max(0,t-0.35)*1.8;
      const g2 = ctx.createRadialGradient(cxF,cyF-S*0.09,0,cxF,cyF,S*0.46);
      g2.addColorStop(0, `rgba(${Math.min(255,bR+55+Math.round(spec*90))},${Math.min(255,bG+45+Math.round(spec*65))},${Math.min(255,bB+55+Math.round(spec*35))},0.97)`);
      g2.addColorStop(0.55, `rgba(${bR+8},${bG+6},${bB+18},0.95)`);
      g2.addColorStop(1,    `rgba(${bR},${bG},${bB},0.92)`);
      ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.closePath();
      ctx.fillStyle=g2; ctx.fill();

      // Edges: gold + blue glow
      ctx.strokeStyle=`rgba(212,175,55,${0.25+t*0.52})`;
      ctx.lineWidth=1.5*DPR;
      ctx.shadowBlur=(7+t*13)*DPR;
      ctx.shadowColor=`rgba(100,160,255,${0.18+t*0.32})`; ctx.stroke(); ctx.shadowBlur=0;

      // Number — small and dimmed on all faces while showing or animating
      if(camDot>0.08){
        const alpha = Math.min(isAnimating ? 0.45 : 0.30, (camDot-0.08)/0.25);
        if(alpha > 0){
          const sz = Math.round(S*0.13*DPR);
          ctx.font=`700 ${sz}px Georgia,serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.shadowBlur=4*DPR; ctx.shadowColor=`rgba(212,175,55,0.4)`;
          ctx.fillStyle=`rgba(180,148,40,${alpha})`;
          ctx.fillText(String(num),cxF,cyF); ctx.shadowBlur=0;
        }
      }
    }

    // Particles
    const next: Particle[] = [];
    for(const p of particles.current){
      p.life -= dt/p.maxLife; if(p.life<=0) continue;
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.025;
      const a = p.life*0.85;
      ctx.shadowBlur=p.size*4*DPR;
      ctx.shadowColor=p.blue?`rgba(100,160,255,${a*0.8})`:`rgba(212,175,55,${a*0.8})`;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(0.4+p.life*0.6),0,Math.PI*2);
      ctx.fillStyle=p.blue?`rgba(150,200,255,${a})`:`rgba(212,175,55,${a})`;
      ctx.fill(); ctx.shadowBlur=0;
      next.push(p);
    }
    particles.current=next;

    // Result overlay — always centered, can't miss it
    if(!isAnimating && targetNumRef.current > 0){
      const n = targetNumRef.current;
      const is20 = n === 20;
      // Dark backdrop circle
      const bd = ctx.createRadialGradient(CX,CY,0,CX,CY,S*0.52);
      bd.addColorStop(0, 'rgba(4,6,22,0.82)');
      bd.addColorStop(0.7, 'rgba(4,6,22,0.55)');
      bd.addColorStop(1, 'rgba(4,6,22,0)');
      ctx.fillStyle=bd; ctx.beginPath(); ctx.arc(CX,CY,S*0.52,0,Math.PI*2); ctx.fill();
      // Glow ring
      ctx.beginPath(); ctx.arc(CX,CY,S*0.44,0,Math.PI*2);
      ctx.strokeStyle=is20?'rgba(160,210,255,0.5)':'rgba(212,175,55,0.45)';
      ctx.lineWidth=1.2*DPR;
      ctx.shadowBlur=12*DPR; ctx.shadowColor=is20?'rgba(100,180,255,0.8)':'rgba(212,175,55,0.7)';
      ctx.stroke(); ctx.shadowBlur=0;
      // Big number
      const sz = n>=10 ? Math.round(S*0.52*DPR) : Math.round(S*0.62*DPR);
      ctx.font=`900 ${sz}px Georgia,serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowBlur=28*DPR; ctx.shadowColor=is20?'rgba(160,210,255,1)':'rgba(212,175,55,1)';
      ctx.fillStyle=is20?'rgba(220,240,255,1)':'rgba(255,215,70,1)';
      ctx.fillText(String(n),CX,CY); ctx.shadowBlur=0;
    }
  }, []);

  useEffect(()=>{
    const canvas = canvasRef.current; if(!canvas) return;
    const DPR = window.devicePixelRatio||1;
    canvas.width=160*DPR; canvas.height=168*DPR;
    canvas.getContext("2d")!.scale(DPR,DPR);
    let last=0;
    const loop=(t:number)=>{
      const dt=Math.min((t-last)/1000,0.05); last=t;
      draw(dt);
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(raf.current);
  },[draw]);

  return (
    <div
      className="flex flex-col items-center cursor-pointer select-none"
      onClick={startRoll}
      title="Klicken zum Würfeln"
    >
      <canvas ref={canvasRef} style={{width:160,height:168,background:"transparent"}} />
      <p className="text-[0.68rem] font-cinzel uppercase tracking-[0.2em] -mt-2" style={{color:"rgba(180,210,255,0.75)"}}>
        {lastRoll !== null ? <>Wurf: <span style={{color: lastRoll===20?'#a0c4ff':'#f0c040', fontWeight:900, fontSize:'0.82rem'}}>{lastRoll}</span></> : 'Würfeln'}
      </p>
    </div>
  );
}

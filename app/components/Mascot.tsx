'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Props {
  size?: number;
}

export default function Mascot({ size = 64 }: Props) {
  const leftPupilRef = useRef<SVGCircleElement>(null);
  const rightPupilRef = useRef<SVGCircleElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Eye centers in the 128x128 viewBox
  const LEFT_EYE = { cx: 55.14, cy: 60.14, r: 5.14 };
  const RIGHT_EYE = { cx: 72.29, cy: 60.14, r: 5.14 };
  const PUPIL_R = 2.2;
  const MAX_OFFSET = 2.4; // max distance pupil can move from center

  const updatePupils = useCallback(() => {
    const svg = svgRef.current;
    const lp = leftPupilRef.current;
    const rp = rightPupilRef.current;
    if (!svg || !lp || !rp) return;

    const rect = svg.getBoundingClientRect();
    const scaleX = 128 / rect.width;
    const scaleY = 128 / rect.height;

    // Convert mouse position to viewBox coordinates
    const mx = (mouseRef.current.x - rect.left) * scaleX;
    const my = (mouseRef.current.y - rect.top) * scaleY;

    for (const { eye, pupil } of [
      { eye: LEFT_EYE, pupil: lp },
      { eye: RIGHT_EYE, pupil: rp },
    ]) {
      const dx = mx - eye.cx;
      const dy = my - eye.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist === 0) {
        pupil.setAttribute('cx', String(eye.cx));
        pupil.setAttribute('cy', String(eye.cy));
      } else {
        const clamp = Math.min(dist, MAX_OFFSET * 10) / (MAX_OFFSET * 10);
        const offset = clamp * MAX_OFFSET;
        pupil.setAttribute('cx', String(eye.cx + (dx / dist) * offset));
        pupil.setAttribute('cy', String(eye.cy + (dy / dist) * offset));
      }
    }
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updatePupils);
    };

    // Listen on the document to track cursor everywhere in the plugin
    document.addEventListener('mousemove', onMouseMove);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updatePupils]);

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 4px 8px rgba(119, 98, 246, 0.25))' }}
    >
      <defs>
        {/* Body gradient for 3D depth */}
        <radialGradient id="bodyGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#9b8aff" />
          <stop offset="60%" stopColor="#7762F6" />
          <stop offset="100%" stopColor="#5a45d6" />
        </radialGradient>
        {/* Highlight/shine */}
        <radialGradient id="shineGrad" cx="38%" cy="30%" r="30%">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        {/* Eye gradient for slight depth */}
        <radialGradient id="eyeGrad" cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E8E8E0" />
        </radialGradient>
      </defs>

      {/* Body */}
      <path
        d="M100 60C100 79.8823 83.8823 96 64 96C54.7797 96 28 96 28 96C28 96 28 70.662 28 60C28 40.1177 44.1178 24 64 24C83.8823 24 100 40.1177 100 60Z"
        fill="url(#bodyGrad)"
      />

      {/* Shine overlay */}
      <path
        d="M100 60C100 79.8823 83.8823 96 64 96C54.7797 96 28 96 28 96C28 96 28 70.662 28 60C28 40.1177 44.1178 24 64 24C83.8823 24 100 40.1177 100 60Z"
        fill="url(#shineGrad)"
      />

      {/* Left eye (sclera) */}
      <circle cx={LEFT_EYE.cx} cy={LEFT_EYE.cy} r={LEFT_EYE.r} fill="url(#eyeGrad)" />
      {/* Right eye (sclera) */}
      <circle cx={RIGHT_EYE.cx} cy={RIGHT_EYE.cy} r={RIGHT_EYE.r} fill="url(#eyeGrad)" />

      {/* Left pupil */}
      <circle
        ref={leftPupilRef}
        cx={LEFT_EYE.cx}
        cy={LEFT_EYE.cy}
        r={PUPIL_R}
        fill="#2d2b3d"
      />
      {/* Left pupil highlight */}
      <circle
        cx={LEFT_EYE.cx + 0.6}
        cy={LEFT_EYE.cy - 0.8}
        r={0.7}
        fill="white"
        opacity="0.8"
      />

      {/* Right pupil */}
      <circle
        ref={rightPupilRef}
        cx={RIGHT_EYE.cx}
        cy={RIGHT_EYE.cy}
        r={PUPIL_R}
        fill="#2d2b3d"
      />
      {/* Right pupil highlight */}
      <circle
        cx={RIGHT_EYE.cx + 0.6}
        cy={RIGHT_EYE.cy - 0.8}
        r={0.7}
        fill="white"
        opacity="0.8"
      />
    </svg>
  );
}

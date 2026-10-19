"use client";

type BrandProps = { size?: "default" | "large"; light?: boolean; className?: string };

export default function Brand({ size = "default", light = false, className = "" }: BrandProps) {
  return (
    <div className={`brand brand-${size}${light ? " brand-light" : ""}${className ? " " + className : ""}`} aria-label="RupeeTrail">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" width="100%" height="100%" fill="none">
          <path d="M12 10H26.5C31 10 32.5 17 26 18.3H12M12 14.5H27M18 19L29 30" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 30C13 26.7 17.2 26.4 22.2 27.9C25.1 28.8 27.6 28.8 31 27" stroke="#87E4BD" strokeWidth="2.6" strokeLinecap="round"/>
          <circle cx="31.7" cy="26.8" r="1.8" fill="#87E4BD"/>
        </svg>
      </span>
      <span className="brand-name"><span>Rupee</span><span className="brand-name-accent">Trail</span></span>
    </div>
  );
}

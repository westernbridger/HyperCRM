"use client";

import { cn } from "@/lib/utils";

interface HyperLogoProps {
  className?: string;
  size?: number;
  showBloom?: boolean;
  animated?: boolean;
}

export function HyperLogo({
  className,
  size = 32,
  showBloom = true,
  animated = true,
}: HyperLogoProps) {
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Bloom / glow effect */}
      {showBloom && (
        <div
          className="absolute inset-0 rounded-lg blur-md opacity-60"
          style={{
            background:
              "radial-gradient(circle, rgba(251,146,60,0.5) 0%, rgba(245,158,11,0.2) 50%, transparent 70%)",
          }}
        />
      )}

      {/* Logo SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <defs>
          {/* Golden-orange gradient for the H */}
          <linearGradient id="hyper-h-gradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="40%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>

          {/* Brighter gradient for the animated stroke */}
          <linearGradient id="hyper-h-stroke" x1="0" y1="0" x2="48" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="50%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>

          {/* Clip path for speed lines inside the H */}
          <clipPath id="hyper-h-clip">
            <path
              d="M14 10 L14 38 L18 38 L18 26 L30 26 L30 38 L34 38 L34 10 L30 10 L30 22 L18 22 L18 10 Z"
              fill="white"
            />
          </clipPath>
        </defs>

        {/* The H shape with gradient fill */}
        <path
          d="M14 10 L14 38 L18 38 L18 26 L30 26 L30 38 L34 38 L34 10 L30 10 L30 22 L18 22 L18 10 Z"
          fill="url(#hyper-h-gradient)"
        />

        {/* Animated speed lines inside the H */}
        {animated && (
          <g clipPath="url(#hyper-h-clip)">
            {/* Horizontal speed lines sweeping across */}
            <rect
              x="-20"
              y="0"
              width="8"
              height="48"
              fill="url(#hyper-h-stroke)"
              opacity="0.5"
            >
              <animate
                attributeName="x"
                from="-20"
                to="60"
                dur="2.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.6;0"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </rect>
            <rect
              x="-20"
              y="0"
              width="4"
              height="48"
              fill="#fde68a"
              opacity="0.3"
            >
              <animate
                attributeName="x"
                from="-20"
                to="60"
                dur="2.5s"
                begin="0.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.5;0"
                dur="2.5s"
                begin="0.8s"
                repeatCount="indefinite"
              />
            </rect>
          </g>
        )}

        {/* Animated border stroke on the H edges */}
        {animated && (
          <path
            d="M14 10 L14 38 L18 38 L18 26 L30 26 L30 38 L34 38 L34 10 L30 10 L30 22 L18 22 L18 10 Z"
            fill="none"
            stroke="url(#hyper-h-stroke)"
            strokeWidth="1.5"
            strokeDasharray="8 4"
            opacity="0.8"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-24"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </path>
        )}

        {/* Subtle inner highlight */}
        <path
          d="M14 10 L14 38 L18 38 L18 26 L30 26 L30 38 L34 38 L34 10 L30 10 L30 22 L18 22 L18 10 Z"
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}

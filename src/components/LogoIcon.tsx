import React from "react";

interface LogoIconProps {
  className?: string;
  size?: number;
}

/**
 * LabelPilot Scheme C Logo Component
 * Notion-inspired layered tags design with architect refinement
 */
export const LogoIcon: React.FC<LogoIconProps> = ({
  className = "",
  size = 24,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter
          id="logo-soft-shadow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="1" />
          <feOffset dx="0" dy="1" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.1" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Bottom Layer - Neutral Gray */}
      <rect
        x="12"
        y="6"
        width="64"
        height="44"
        rx="6"
        fill="currentColor"
        className="text-gray-300 dark:text-gray-600"
        opacity="0.4"
      />

      {/* Middle Layer - Neutral Gray */}
      <rect
        x="6"
        y="12"
        width="64"
        height="44"
        rx="6"
        fill="currentColor"
        className="text-gray-400 dark:text-gray-500"
        opacity="0.6"
      />

      {/* Top Layer - Brand Indigo */}
      <g filter="url(#logo-soft-shadow)">
        <rect
          x="0"
          y="18"
          width="64"
          height="44"
          rx="6"
          style={{ fill: "var(--logo-primary)" }}
        />
        {/* Yellow Accent - Dot/Indicator */}
        <rect
          x="48"
          y="26"
          width="8"
          height="8"
          rx="2"
          style={{ fill: "var(--logo-accent)" }}
        />
        {/* Inner subtle stroke for refinement */}
        <rect
          x="0.5"
          y="18.5"
          width="63"
          height="43"
          rx="5.5"
          stroke="white"
          strokeWidth="0.5"
          opacity="0.2"
        />
      </g>
    </svg>
  );
};

import React, { useId } from 'react';

type AikyaLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showText?: boolean;
};

const AikyaLogo: React.FC<AikyaLogoProps> = ({
  className = '',
  markClassName = 'h-9 w-9',
  textClassName = '',
  showText = true
}) => {
  const gradientId = useId();

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        className={markClassName}
        viewBox="0 0 64 64"
        fill="none"
        role="img"
        aria-label="Aikya"
      >
        <defs>
          <linearGradient id={gradientId} x1="12" y1="12" x2="52" y2="52">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="55%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <circle
          cx="32"
          cy="32"
          r="22"
          stroke={`url(#${gradientId})`}
          strokeWidth="3.5"
          opacity="0.9"
        />
        <path
          d="M18 27c5-7 13-11 14-11s9 4 14 11"
          stroke={`url(#${gradientId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M18 37c5 7 13 11 14 11s9-4 14-11"
          stroke={`url(#${gradientId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="32" cy="32" r="4" fill={`url(#${gradientId})`} />
      </svg>
      {showText && (
        <span className={`font-display text-xl tracking-wide text-slate-100 ${textClassName}`}>
          Aikya
        </span>
      )}
    </div>
  );
};

export default AikyaLogo;

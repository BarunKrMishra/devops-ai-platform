import React from 'react';

type SkeletonBlockProps = {
  className?: string;
};

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ className }) => {
  return (
    <div className={`animate-pulse rounded-xl bg-white/10 ${className || ''}`} />
  );
};

export default SkeletonBlock;

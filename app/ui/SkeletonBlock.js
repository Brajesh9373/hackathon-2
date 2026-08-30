'use client';

export default function SkeletonBlock({ lines = 3, className = '' }) {
  return <div className={`v-skeleton-block ${className}`.trim()} aria-label="Loading content" aria-busy="true">
    {Array.from({ length: lines }, (_, index) => <span key={index} style={{ width: `${Math.max(45, 92 - index * 13)}%` }} />)}
  </div>;
}

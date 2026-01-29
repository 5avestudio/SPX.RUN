"use client"

export function SacredGeometry({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full animate-sacred-rotate"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      >
        {/* Seed of Life pattern */}
        <circle cx="100" cy="100" r="40" className="text-white/20" />
        <circle cx="100" cy="60" r="40" className="text-white/20" />
        <circle cx="134.6" cy="80" r="40" className="text-white/20" />
        <circle cx="134.6" cy="120" r="40" className="text-white/20" />
        <circle cx="100" cy="140" r="40" className="text-white/20" />
        <circle cx="65.4" cy="120" r="40" className="text-white/20" />
        <circle cx="65.4" cy="80" r="40" className="text-white/20" />
      </svg>
    </div>
  )
}

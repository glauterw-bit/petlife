'use client'

/**
 * Vyron — a mascote veterinária do PetLife (lição do ADA 2026: personagem
 * com personalidade cria apego). Cachorrinho SVG com estetoscópio, olhos que
 * piscam e estados: idle (flutua), thinking (orelhas mexem + olhos pra cima)
 * e celebrating (pula). Tudo CSS puro, respeita prefers-reduced-motion.
 */

interface VyronAvatarProps {
  size?: number
  state?: 'idle' | 'thinking' | 'celebrating'
  className?: string
}

export function VyronAvatar({ size = 48, state = 'idle', className = '' }: VyronAvatarProps) {
  return (
    <div
      className={`vyron vyron-${state} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" className="w-full h-full">
        {/* orelhas */}
        <g className="vyron-ear-l">
          <path d="M14 22 Q10 6 22 10 Q26 14 24 24 Z" fill="#059669" />
          <path d="M16.5 20 Q14.5 10 21 12.5 Q23.5 15 22 21.5 Z" fill="#34d399" />
        </g>
        <g className="vyron-ear-r">
          <path d="M50 22 Q54 6 42 10 Q38 14 40 24 Z" fill="#059669" />
          <path d="M47.5 20 Q49.5 10 43 12.5 Q40.5 15 42 21.5 Z" fill="#34d399" />
        </g>
        {/* cabeça */}
        <circle cx="32" cy="32" r="20" fill="#10b981" />
        <circle cx="32" cy="36" r="13" fill="#a7f3d0" opacity="0.9" />
        {/* olhos */}
        <g className="vyron-eyes">
          <circle className="vyron-eye" cx="25" cy="29" r="3" fill="#1c1917" />
          <circle className="vyron-eye" cx="39" cy="29" r="3" fill="#1c1917" />
          <circle cx="26" cy="28" r="1" fill="#fff" />
          <circle cx="40" cy="28" r="1" fill="#fff" />
        </g>
        {/* focinho */}
        <ellipse cx="32" cy="36.5" rx="4.2" ry="3.2" fill="#1c1917" />
        <path className="vyron-mouth" d="M27 42 Q32 46 37 42" stroke="#065f46" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* língua (só celebrando) */}
        <path className="vyron-tongue" d="M30 43.5 Q32 47.5 34 43.5 Z" fill="#fb7185" />
        {/* estetoscópio */}
        <path d="M22 48 Q22 55 30 55 L38 55" stroke="#57534e" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="41" cy="55" r="3.4" fill="#57534e" />
        <circle cx="41" cy="55" r="1.8" fill="#d6d3d1" />
        <circle cx="22" cy="46.5" r="2" fill="#57534e" />
      </svg>

      <style jsx>{`
        .vyron { display: inline-block; position: relative; }
        .vyron-idle { animation: vyronFloat 3.2s ease-in-out infinite; }
        .vyron-celebrating { animation: vyronJump 0.55s cubic-bezier(0.3, 1.4, 0.5, 1) 2; }
        @keyframes vyronFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes vyronJump {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          40% { transform: translateY(-7px) rotate(-4deg); }
          70% { transform: translateY(-3px) rotate(3deg); }
        }
        .vyron :global(.vyron-eye) { animation: vyronBlink 4.6s infinite; transform-origin: center; transform-box: fill-box; }
        @keyframes vyronBlink {
          0%, 94%, 100% { transform: scaleY(1); }
          96%, 98% { transform: scaleY(0.12); }
        }
        .vyron-thinking :global(.vyron-eyes) { animation: vyronLook 1.1s ease-in-out infinite alternate; }
        @keyframes vyronLook {
          from { transform: translateY(0); }
          to { transform: translateY(-1.6px); }
        }
        .vyron-thinking :global(.vyron-ear-l) { animation: vyronEarL 0.9s ease-in-out infinite alternate; transform-origin: 20px 22px; transform-box: view-box; }
        .vyron-thinking :global(.vyron-ear-r) { animation: vyronEarR 0.9s ease-in-out infinite alternate; transform-origin: 44px 22px; transform-box: view-box; }
        @keyframes vyronEarL { from { transform: rotate(0deg); } to { transform: rotate(-6deg); } }
        @keyframes vyronEarR { from { transform: rotate(0deg); } to { transform: rotate(6deg); } }
        .vyron :global(.vyron-tongue) { opacity: 0; }
        .vyron-celebrating :global(.vyron-tongue) { opacity: 1; }
        .vyron-celebrating :global(.vyron-mouth) { opacity: 0; }
        @media (prefers-reduced-motion: reduce) {
          .vyron, .vyron :global(*) { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

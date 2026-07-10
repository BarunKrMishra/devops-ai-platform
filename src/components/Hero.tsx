import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useContent } from '../contexts/ContentContext';

// Scoped, dependency-free 3D hero visual. All classes are prefixed `aikyahero-`
// and the animation is pure CSS (GPU transforms), so it stays isolated to this
// component and cannot affect the bundle, other views, or any backend service.
const heroStyles = `
.aikyahero-stage { position: relative; perspective: 1100px; }
.aikyahero-core {
  position: absolute; top: 50%; left: 50%; width: 360px; height: 360px; max-width: 92%;
  transform: translate(-50%, -50%); pointer-events: none; z-index: 0;
  transform-style: preserve-3d;
}
.aikyahero-orb {
  position: absolute; inset: 39%; border-radius: 50%;
  background: radial-gradient(circle at 32% 26%, #fde68a 0%, #f59e0b 40%, #14b8a6 80%, #0f766e 100%);
  box-shadow: 0 0 60px rgba(20,184,166,0.40), 0 0 110px rgba(245,158,11,0.22), inset 0 0 22px rgba(255,255,255,0.30);
  animation: aikyahero-pulse 5s ease-in-out infinite;
}
.aikyahero-ring { position: absolute; border-radius: 50%; border: 1.5px solid; will-change: transform; }
.aikyahero-ring.a { inset: 0;   border-color: rgba(251,191,36,0.50); animation: aikyahero-a 15s linear infinite; }
.aikyahero-ring.b { inset: 9%;  border-color: rgba(45,212,191,0.50); animation: aikyahero-b 19s linear infinite; }
.aikyahero-ring.c { inset: 18%; border-color: rgba(255,255,255,0.16); animation: aikyahero-c 24s linear infinite; }
.aikyahero-dot {
  position: absolute; top: -5px; left: 50%; margin-left: -5px;
  width: 10px; height: 10px; border-radius: 50%; background: #fbbf24;
  box-shadow: 0 0 14px #fbbf24, 0 0 26px rgba(251,191,36,0.6);
}
.aikyahero-ring.b .aikyahero-dot { background: #2dd4bf; box-shadow: 0 0 14px #2dd4bf, 0 0 26px rgba(45,212,191,0.6); }
@keyframes aikyahero-a { from { transform: rotateX(72deg) rotateZ(0deg); }            to { transform: rotateX(72deg) rotateZ(360deg); } }
@keyframes aikyahero-b { from { transform: rotateX(72deg) rotateY(42deg) rotateZ(0deg); } to { transform: rotateX(72deg) rotateY(42deg) rotateZ(-360deg); } }
@keyframes aikyahero-c { from { transform: rotateY(74deg) rotateZ(0deg); }            to { transform: rotateY(74deg) rotateZ(360deg); } }
@keyframes aikyahero-pulse { 0%,100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.06); filter: brightness(1.14); } }
.aikyahero-panel { position: relative; z-index: 1; transition: transform 0.6s cubic-bezier(.2,.7,.2,1); }
.aikyahero-stage:hover .aikyahero-panel { transform: rotateY(-4deg) rotateX(2.5deg); }
@media (prefers-reduced-motion: reduce) {
  .aikyahero-orb, .aikyahero-ring { animation: none !important; }
  .aikyahero-stage:hover .aikyahero-panel { transform: none; }
}
`;

const Hero: React.FC = () => {
  const { content } = useContent();
  const hero = content.landing.hero;
  const stats = hero.stats || [];
  const signals = hero.signals || [];
  const highlights = hero.highlights || [];
  const panel = hero.panel;

  const renderCta = (cta: { label: string; to: string }, className: string) => {
    if (!cta) {
      return null;
    }
    const isExternal = cta.to.startsWith('http') || cta.to.startsWith('mailto:');
    if (isExternal) {
      return (
        <a href={cta.to} className={className}>
          <span className="text-lg font-semibold">{cta.label}</span>
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </a>
      );
    }
    return (
      <Link to={cta.to} className={className}>
        <span className="text-lg font-semibold">{cta.label}</span>
        <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
      </Link>
    );
  };

  const accentMap: Record<string, string> = {
    emerald: 'text-emerald-200 bg-emerald-500/10 border-emerald-500/30',
    amber: 'text-amber-200 bg-amber-500/10 border-amber-500/30',
    teal: 'text-teal-200 bg-teal-500/10 border-teal-500/30'
  };

  return (
    <section className="pt-32 pb-24 px-6">
      <div className="container mx-auto">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm text-amber-200">
              <Sparkles className="h-4 w-4 text-amber-300" />
              {hero.kicker}
            </div>

            <div className="space-y-3">
              <h1 className="text-5xl md:text-7xl font-display text-white leading-tight aikya-rise">
                {hero.title}
                {hero.highlight && (
                  <span className="block gradient-text">{hero.highlight}</span>
                )}
              </h1>
              <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-2xl">
                {hero.subtitle}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {renderCta(
                hero.primaryCta,
                'group px-8 py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-teal-500 text-white rounded-xl hover:from-amber-600 hover:via-orange-600 hover:to-teal-600 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2'
              )}
              {hero.secondaryCta &&
                renderCta(
                  hero.secondaryCta,
                  'group px-8 py-4 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all border border-white/10 text-center flex items-center justify-center gap-2'
                )}
            </div>

            {highlights.length > 0 && (
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                {highlights.map((item) => (
                  <span key={item} className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="relative aikya-float aikyahero-stage">
            <style>{heroStyles}</style>
            <div className="absolute -top-10 -left-12 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl"></div>
            <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-teal-500/20 blur-3xl"></div>

            {/* Animated 3D "operations intelligence" core behind the panel */}
            <div className="aikyahero-core" aria-hidden="true">
              <div className="aikyahero-ring a"><span className="aikyahero-dot"></span></div>
              <div className="aikyahero-ring b"><span className="aikyahero-dot"></span></div>
              <div className="aikyahero-ring c"></div>
              <div className="aikyahero-orb"></div>
            </div>

            <div className="aikyahero-panel relative glass rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{panel?.kicker}</p>
                  <h3 className="text-2xl font-semibold text-white mt-2">
                    {stats[0]?.value || '0'} {stats[0]?.label || 'Ops'}
                  </h3>
                </div>
                {panel?.status && (
                  <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 text-xs">
                    {panel.status}
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-slate-300">{stat.label}</p>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="text-2xl font-semibold text-white">{stat.value}</span>
                      <span className="text-xs text-slate-400">{stat.detail}</span>
                    </div>
                  </div>
                ))}
              </div>

              {signals.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3">
                  {signals.map((signal) => (
                    <div
                      key={signal.label}
                      className={`px-3 py-2 rounded-xl border text-sm ${accentMap[signal.accent] || 'text-slate-200 bg-white/5 border-white/10'}`}
                    >
                      <span className="block text-xs uppercase tracking-[0.2em] text-slate-400">{signal.label}</span>
                      <span className="text-lg font-semibold">{signal.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useContent } from '../contexts/ContentContext';

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

          <div className="relative aikya-float">
            <div className="absolute -top-10 -left-12 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl"></div>
            <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-teal-500/20 blur-3xl"></div>

            <div className="relative glass rounded-2xl p-6 backdrop-blur-sm">
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

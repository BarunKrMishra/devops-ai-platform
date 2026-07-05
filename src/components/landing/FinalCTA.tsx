import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useContent } from '../../contexts/ContentContext';

const FinalCTA: React.FC = () => {
  const { content } = useContent();
  const finalCta = content.landing.finalCta;

  const renderCta = (cta: { label: string; to: string }, className: string) => {
    if (!cta) {
      return null;
    }
    const isExternal = cta.to.startsWith('http') || cta.to.startsWith('mailto:');
    if (isExternal) {
      return (
        <a href={cta.to} className={className}>
          {cta.label}
          <ArrowRight className="h-4 w-4" />
        </a>
      );
    }
    return (
      <Link to={cta.to} className={className}>
        {cta.label}
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  };

  return (
    <section className="px-6 pb-24">
      <div className="container mx-auto">
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-teal-500/15 rounded-2xl p-10 border border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div>
              <h3 className="text-3xl font-display text-white">{finalCta.title}</h3>
              <p className="text-slate-300 mt-3 max-w-2xl">{finalCta.subtitle}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              {renderCta(
                finalCta.primaryCta,
                'px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 text-white hover:from-amber-600 hover:to-teal-600 transition-all inline-flex items-center gap-2 justify-center'
              )}
              {finalCta.secondaryCta && renderCta(
                finalCta.secondaryCta,
                'px-6 py-3 rounded-xl border border-white/10 text-white hover:bg-white/10 transition-all inline-flex items-center gap-2 justify-center'
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;

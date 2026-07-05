import React from 'react';
import { useContent } from '../../contexts/ContentContext';

const TrustBar: React.FC = () => {
  const { content } = useContent();
  const trust = content.landing.trust;
  const sectors = trust.tags || [];

  return (
    <section className="px-6 pb-12">
      <div className="container mx-auto">
        <div className="glass rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{trust.kicker}</p>
            <h3 className="text-2xl font-display text-white mt-3">{trust.title}</h3>
            <p className="text-slate-300 mt-2">{trust.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {sectors.map((sector) => (
              <span
                key={sector}
                className="px-4 py-2 rounded-full border border-white/10 text-slate-200 text-sm bg-white/5"
              >
                {sector}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustBar;

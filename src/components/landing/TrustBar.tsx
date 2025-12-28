import React from 'react';

const TrustBar: React.FC = () => {
  const sectors = ['Fintech', 'SaaS', 'Retail', 'HealthTech', 'Media', 'GovOps'];

  return (
    <section className="px-6 pb-12">
      <div className="container mx-auto">
        <div className="glass rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Trusted globally</p>
            <h3 className="text-2xl font-display text-white mt-3">
              Teams choose Aikya for stable releases.
            </h3>
            <p className="text-slate-300 mt-2">
              Designed for modern engineering orgs shipping mission-critical platforms.
            </p>
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

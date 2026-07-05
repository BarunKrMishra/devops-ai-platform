import React from 'react';
import { useContent } from '../../contexts/ContentContext';
import { getIcon } from '../../utils/iconMap';

const UseCases: React.FC = () => {
  const { content } = useContent();
  const section = content.landing.useCasesSection;
  const cases = content.landing.useCases || [];

  return (
    <section className="px-6 pb-20">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{section?.kicker}</p>
            <h3 className="text-3xl font-display text-white mt-3">{section?.title}</h3>
          </div>
          <p className="text-slate-300 max-w-xl">{section?.subtitle}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {cases.map((item) => {
            const Icon = getIcon(item.icon);
            return (
            <div key={item.title} className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-amber-300" />
                </div>
                <h4 className="text-xl font-semibold text-white">{item.title}</h4>
              </div>
              <p className="text-slate-300 mt-4">{item.description}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {item.bullets.map((bullet) => (
                  <li key={bullet}>- {bullet}</li>
                ))}
              </ul>
            </div>
          )})}
        </div>
      </div>
    </section>
  );
};

export default UseCases;

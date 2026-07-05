import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useContent } from '../../contexts/ContentContext';
import { getIcon } from '../../utils/iconMap';

const OpsSuite: React.FC = () => {
  const { content } = useContent();
  const section = content.landing.opsSuitesSection;
  const suites = content.landing.opsSuites || [];

  return (
    <section id="ops" className="px-6 pb-20">
      <div className="container mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{section?.kicker}</p>
            <h3 className="text-3xl font-display text-white mt-3">{section?.title}</h3>
          </div>
          <div className="max-w-xl text-slate-300">
            {section?.subtitle}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {suites.map((suite) => {
            const Icon = getIcon(suite.icon);
            return (
            <div key={suite.title} className="glass rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-amber-300" />
                </div>
                <h4 className="text-xl font-semibold text-white">{suite.title}</h4>
              </div>
              <p className="text-slate-300 mt-4">{suite.description}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {suite.highlights.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
              {section?.badge && (
                <div className="mt-4 inline-flex items-center gap-2 text-sm text-amber-200">
                  <Sparkles className="h-4 w-4" />
                  {section.badge}
                </div>
              )}
            </div>
          )})}
        </div>

        {section?.cta && (
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 bg-white/5 rounded-2xl border border-white/10 p-6">
            <div>
              <h4 className="text-xl font-semibold text-white">{section.ctaTitle}</h4>
              <p className="text-slate-400 mt-2">{section.ctaSubtitle}</p>
            </div>
            <Link
              to={section.cta.to}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-teal-500 text-white rounded-xl hover:from-amber-600 hover:to-teal-600 transition-all"
            >
              {section.cta.label}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default OpsSuite;

import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Check } from 'lucide-react';
import { useContent } from '../../contexts/ContentContext';
import { getIcon } from '../../utils/iconMap';

const SUITE_GRADIENTS = [
  'from-amber-500/30 to-orange-500/10',
  'from-teal-500/30 to-emerald-500/10',
  'from-sky-500/30 to-teal-500/10',
  'from-emerald-500/30 to-teal-500/10',
  'from-violet-500/30 to-sky-500/10',
  'from-rose-500/30 to-amber-500/10'
];

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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 [perspective:1400px]">
          {suites.map((suite, index) => {
            const Icon = getIcon(suite.icon);
            return (
            <div key={suite.title} className="aikya-tilt glass rounded-2xl p-6 border border-white/10 hover:border-amber-400/30">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${SUITE_GRADIENTS[index % SUITE_GRADIENTS.length]} flex items-center justify-center`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h4 className="text-xl font-semibold text-white">{suite.title}</h4>
              </div>
              <p className="text-slate-300 mt-4">{suite.description}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {suite.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-teal-300 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
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

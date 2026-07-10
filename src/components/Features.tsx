import React from 'react';
import { Link } from 'react-router-dom';
import { useContent } from '../contexts/ContentContext';
import { getIcon } from '../utils/iconMap';

const Features: React.FC = () => {
  const { content } = useContent();
  const features = content.landing.features || [];
  const section = content.landing.featuresSection;
  const gradients = [
    'from-amber-500/40 to-orange-500/20',
    'from-teal-500/40 to-emerald-500/20',
    'from-orange-500/40 to-amber-500/20',
    'from-emerald-500/40 to-teal-500/20',
    'from-sky-500/40 to-teal-500/20',
    'from-amber-500/40 to-rose-500/20'
  ];

  return (
    <section id="features" className="py-20 px-6">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{section?.kicker}</p>
          <h2 className="text-4xl md:text-5xl font-display text-white mb-6 mt-4">
            {section?.title}
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            {section?.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 [perspective:1200px]">
          {features.map((feature, index) => {
            const Icon = getIcon(feature.icon);
            return (
            <div
              key={index}
              className="aikya-tilt group bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:bg-white/10 hover:border-amber-400/30"
            >
              <div className={`p-4 bg-gradient-to-r ${gradients[index % gradients.length]} rounded-xl w-fit mb-6 group-hover:scale-110 transition-transform`}>
                <Icon className="h-8 w-8 text-white" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          )})}
        </div>

        {section?.cta && (
          <div className="mt-20 text-center">
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-teal-500/10 rounded-2xl p-8 border border-white/10 max-w-4xl mx-auto">
              <h3 className="text-2xl font-bold text-white mb-4">{section.cta.title}</h3>
              <p className="text-slate-300 mb-6">{section.cta.subtitle}</p>
              <Link
                to={section.cta.to}
                className="px-8 py-4 bg-gradient-to-r from-amber-500 to-teal-500 text-white rounded-xl hover:from-amber-600 hover:to-teal-600 transition-all transform hover:scale-[1.02] inline-flex items-center justify-center"
              >
                {section.cta.label}
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Features;

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useContent } from '../../contexts/ContentContext';
import { getIcon } from '../../utils/iconMap';

const Workflow: React.FC = () => {
  const { content } = useContent();
  const workflow = content.landing.workflow;
  const steps = workflow.steps || [];

  return (
    <section className="px-6 pb-20">
      <div className="container mx-auto">
        <div className="glass rounded-2xl p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{workflow.kicker}</p>
              <h3 className="text-3xl font-display text-white mt-3">
                {workflow.title}
              </h3>
            </div>
            <p className="text-slate-300 max-w-xl">{workflow.subtitle}</p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = getIcon(step.icon);
              return (
                <div key={step.title} className="rounded-2xl border border-white/10 p-6 bg-white/5">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-teal-300" />
                    <span className="text-sm text-slate-400">Step {index + 1}</span>
                  </div>
                  <h4 className="text-xl font-semibold text-white mt-4">{step.title}</h4>
                  <p className="text-slate-300 mt-2">{step.description}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex items-center gap-2 text-sm text-slate-400">
            {workflow.note}
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Workflow;

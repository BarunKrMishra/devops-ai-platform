import React from 'react';
import { ArrowRight, LayoutGrid, Radar, Shield } from 'lucide-react';

const Workflow: React.FC = () => {
  const steps = [
    {
      title: 'Connect the stack',
      description: 'Link repos, environments, and cloud accounts in minutes.',
      icon: LayoutGrid
    },
    {
      title: 'Sense the signal',
      description: 'Aikya tracks deployments, drift, and anomalies in real time.',
      icon: Radar
    },
    {
      title: 'Ship with guardrails',
      description: 'Release with approvals, auto-healing, and audit-ready logs.',
      icon: Shield
    }
  ];

  return (
    <section className="px-6 pb-20">
      <div className="container mx-auto">
        <div className="glass rounded-2xl p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">How it works</p>
              <h3 className="text-3xl font-display text-white mt-3">
                Aikya brings structure to every release.
              </h3>
            </div>
            <p className="text-slate-300 max-w-xl">
              Move from connected tooling to calm execution without changing how your team works.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-white/10 p-6 bg-white/5">
                <div className="flex items-center gap-3">
                  <step.icon className="h-5 w-5 text-teal-300" />
                  <span className="text-sm text-slate-400">Step {index + 1}</span>
                </div>
                <h4 className="text-xl font-semibold text-white mt-4">{step.title}</h4>
                <p className="text-slate-300 mt-2">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-2 text-sm text-slate-400">
            Aikya keeps the flow connected end-to-end
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Workflow;

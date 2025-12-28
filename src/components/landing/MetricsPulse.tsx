import React, { useEffect, useState } from 'react';
import { Activity, ArrowUpRight } from 'lucide-react';

const metrics = [
  { label: 'Deploys orchestrated', value: '18,240', detail: '+12% this month' },
  { label: 'Incidents auto-resolved', value: '1,382', detail: '-28% MTTR' },
  { label: 'Cloud cost saved', value: '$214k', detail: 'avg per quarter' },
  { label: 'Guardrails triggered', value: '7,904', detail: 'zero critical escapes' }
];

const MetricsPulse: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % metrics.length);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="px-6 pb-20">
      <div className="container mx-auto">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass rounded-2xl p-8">
            <div className="flex items-center gap-3 text-amber-200">
              <Activity className="h-5 w-5" />
              <span className="text-sm uppercase tracking-[0.3em]">Aikya Pulse</span>
            </div>
            <h3 className="text-3xl font-display text-white mt-4">
              Live operational clarity without the noise.
            </h3>
            <p className="text-slate-300 mt-3">
              Aikya surfaces the right signal and keeps teams aligned with calm, continuous insights.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {metrics.map((metric, index) => (
                <div
                  key={metric.label}
                  className={`rounded-xl border border-white/10 p-4 ${
                    index === activeIndex ? 'bg-white/10' : 'bg-white/5'
                  } transition-all`}
                >
                  <p className="text-sm text-slate-400">{metric.label}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-2xl font-semibold text-white">{metric.value}</span>
                    <ArrowUpRight className="h-4 w-4 text-teal-300" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{metric.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-8 flex flex-col justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Why it feels alive</p>
              <h4 className="text-2xl font-display text-white mt-4">Operational context, refreshed.</h4>
              <p className="text-slate-300 mt-3">
                Aikya keeps your team focused on the most important workflows, updated every few minutes.
              </p>
            </div>
            <div className="mt-8 space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                Deployment readiness signals
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-400"></span>
                Cost and capacity forecasts
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-400"></span>
                Incident and drift watchlists
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MetricsPulse;

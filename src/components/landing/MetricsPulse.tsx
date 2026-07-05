import React, { useEffect, useState } from 'react';
import { Activity, ArrowUpRight } from 'lucide-react';
import { useContent } from '../../contexts/ContentContext';

const MetricsPulse: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const { content } = useContent();
  const metricsPulse = content.landing.metricsPulse;
  const metrics = metricsPulse.metrics || [];
  const insightPanel = metricsPulse.insightPanel;

  useEffect(() => {
    if (metrics.length < 1) {
      return;
    }
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % metrics.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [metrics.length]);

  return (
    <section className="px-6 pb-20">
      <div className="container mx-auto">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass rounded-2xl p-8">
            <div className="flex items-center gap-3 text-amber-200">
              <Activity className="h-5 w-5" />
              <span className="text-sm uppercase tracking-[0.3em]">{metricsPulse.kicker}</span>
            </div>
            <h3 className="text-3xl font-display text-white mt-4">
              {metricsPulse.title}
            </h3>
            <p className="text-slate-300 mt-3">
              {metricsPulse.subtitle}
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
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{insightPanel?.kicker}</p>
              <h4 className="text-2xl font-display text-white mt-4">{insightPanel?.title}</h4>
              <p className="text-slate-300 mt-3">{insightPanel?.subtitle}</p>
            </div>
            <div className="mt-8 space-y-3 text-sm text-slate-300">
              {metricsPulse.insights?.map((insight, index) => (
                <div key={insight} className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      index % 3 === 0 ? 'bg-amber-400' : index % 3 === 1 ? 'bg-teal-400' : 'bg-orange-400'
                    }`}
                  ></span>
                  {insight}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MetricsPulse;

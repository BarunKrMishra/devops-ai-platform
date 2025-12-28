import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, GitBranch, Shield, Cpu } from 'lucide-react';

const Hero: React.FC = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/login');
  };

  return (
    <section className="pt-32 pb-24 px-6">
      <div className="container mx-auto">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm text-amber-200">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Unified DevOps Intelligence
            </div>

            <h1 className="text-5xl md:text-7xl font-display text-white leading-tight aikya-rise">
              Aikya aligns
              <span className="block gradient-text">pipeline, infra, and AI</span>
              into one calm flow.
            </h1>

            <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-2xl">
              Ship with a platform that feels mythic yet minimal. Aikya predicts failures, coordinates
              deployments, and keeps every service in perfect unity.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleGetStarted}
                className="group px-8 py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-teal-500 text-white rounded-xl hover:from-amber-600 hover:via-orange-600 hover:to-teal-600 transition-all transform hover:scale-[1.02] flex items-center justify-center space-x-2"
              >
                <span className="text-lg font-semibold">Enter Aikya</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <Link
                to={{ pathname: '/', hash: '#features' }}
                className="px-8 py-4 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all border border-white/10 text-center"
              >
                <span className="text-lg font-semibold">View Live Preview</span>
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 text-sm text-slate-400">
              <span>Guided rollout</span>
              <span>Adaptive scaling</span>
              <span>Predictive guardrails</span>
            </div>
          </div>

          <div className="relative aikya-float">
            <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl"></div>
            <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-teal-500/20 blur-3xl"></div>

            <div className="relative bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Harmony Loop</p>
                  <h3 className="text-2xl font-semibold text-white mt-2">12 pipelines, 1 pulse</h3>
                </div>
                <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 text-xs">
                  Live
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-teal-300" /> Release sync
                    </span>
                    <span>94%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-gradient-to-r from-teal-400 to-amber-400 w-[94%]" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-300" /> Drift protection
                    </span>
                    <span>99.2%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 w-[99%]" />
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <Cpu className="h-4 w-4 text-teal-300" /> Compute
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-white">-28%</div>
                  <p className="text-xs text-slate-400">Energy footprint</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <Sparkles className="h-4 w-4 text-amber-300" /> AI Action
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-white">3.4k</div>
                  <p className="text-xs text-slate-400">Ops tasks unified</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

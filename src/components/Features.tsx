import React from 'react';
import { Link } from 'react-router-dom';
import { Cloud, GitBranch, DollarSign, Sparkles, Gauge, Shield } from 'lucide-react';

const Features: React.FC = () => {
  const features = [
    {
      icon: Cloud,
      title: 'Multi-Cloud Fabric',
      description: 'A single control plane for AWS, Azure, GCP, and edge fleets with instant drift repair.',
      color: 'from-teal-500 to-cyan-500'
    },
    {
      icon: GitBranch,
      title: 'Pipeline Orchestration',
      description: 'Adaptive CI/CD that learns your release tempo and keeps every stage in sync.',
      color: 'from-amber-500 to-orange-500'
    },
    {
      icon: DollarSign,
      title: 'Cost Harmony',
      description: 'Aikya balances performance and spend with AI-led savings across environments.',
      color: 'from-emerald-500 to-teal-500'
    },
    {
      icon: Sparkles,
      title: 'Human-AI Copilot',
      description: 'Ask in natural language and Aikya turns it into safe, audited infrastructure actions.',
      color: 'from-amber-500 to-rose-500'
    },
    {
      icon: Gauge,
      title: 'Predictive Guardrails',
      description: 'Detect anomalies early with proactive playbooks and real-time intelligence.',
      color: 'from-teal-500 to-sky-500'
    },
    {
      icon: Shield,
      title: 'Compliance Thread',
      description: 'Continuous security, audit trails, and policy enforcement woven into every deploy.',
      color: 'from-orange-500 to-amber-500'
    }
  ];

  return (
    <section id="features" className="py-20 px-6">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-display text-white mb-6">
            Aikya is built for
            <span className="block gradient-text">modern, steady teams</span>
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            A unified DevOps experience with mythic calm and modern control.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:translate-y-[-4px]"
            >
              <div className={`p-4 bg-gradient-to-r ${feature.color} rounded-xl w-fit mb-6 group-hover:scale-110 transition-transform`}>
                <feature.icon className="h-8 w-8 text-white" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-teal-500/10 rounded-2xl p-8 border border-white/10 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-4">Ready to unify your DevOps flow?</h3>
            <p className="text-slate-300 mb-6">
              Launch Aikya with a focused team and scale without losing clarity.
            </p>
            <Link
              to="/login"
              className="px-8 py-4 bg-gradient-to-r from-amber-500 to-teal-500 text-white rounded-xl hover:from-amber-600 hover:to-teal-600 transition-all transform hover:scale-[1.02] inline-flex items-center justify-center"
            >
              Start with Aikya
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;

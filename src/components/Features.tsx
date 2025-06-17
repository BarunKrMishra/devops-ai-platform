import React from 'react';
import { Cloud, GitBranch, DollarSign, Bot, Gauge, Lock } from 'lucide-react';

const Features: React.FC = () => {
  const features = [
    {
      icon: Cloud,
      title: 'Multi-Cloud Support',
      description: 'Deploy seamlessly across AWS, Azure, GCP, and more with unified management.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: GitBranch,
      title: 'CI/CD Automation',
      description: 'Intelligent pipelines that adapt to your code and automatically optimize deployment strategies.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: DollarSign,
      title: 'Cost Optimization',
      description: 'AI-driven recommendations to reduce cloud costs without compromising performance.',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: Bot,
      title: 'Natural Language Commands',
      description: 'Tell the AI what you want in plain English: "Scale my app for Black Friday traffic".',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: Gauge,
      title: 'Real-time Monitoring',
      description: 'Advanced observability with predictive analytics and automated incident response.',
      color: 'from-indigo-500 to-purple-500'
    },
    {
      icon: Lock,
      title: 'Enterprise Security',
      description: 'Built-in security scanning, compliance checks, and automated vulnerability patching.',
      color: 'from-teal-500 to-blue-500'
    }
  ];

  return (
    <section className="py-20 px-6">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Everything You Need for
            <span className="block text-transparent bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text">
              Modern DevOps
            </span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Our AI assistant handles the complexity so you can focus on building amazing products
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:transform hover:scale-105"
            >
              <div className={`p-4 bg-gradient-to-r ${feature.color} rounded-xl w-fit mb-6 group-hover:scale-110 transition-transform`}>
                <feature.icon className="h-8 w-8 text-white" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl p-8 border border-white/10 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-4">Ready to Transform Your DevOps?</h3>
            <p className="text-gray-300 mb-6">
              Join thousands of developers who have already automated their infrastructure with AI
            </p>
            <button className="px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all transform hover:scale-105">
              Start Free Trial
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
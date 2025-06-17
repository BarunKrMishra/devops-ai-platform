import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Shield, Cpu } from 'lucide-react';

const Hero: React.FC = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/login');
  };

  return (
    <section className="pt-32 pb-20 px-6">
      <div className="container mx-auto text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            AI-Powered
            <span className="block bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              DevOps Assistant
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed">
            Automate your entire DevOps pipeline with intelligent AI that deploys, scales, 
            and heals your applications across any cloud platform.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button
              onClick={handleGetStarted}
              className="group px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all transform hover:scale-105 flex items-center justify-center space-x-2"
            >
              <span className="text-lg font-semibold">Start Building</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="px-8 py-4 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all backdrop-blur-sm">
              <span className="text-lg font-semibold">Watch Demo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all">
              <div className="p-3 bg-purple-500/20 rounded-lg w-fit mx-auto mb-4">
                <Zap className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Instant Deployment</h3>
              <p className="text-gray-400">Deploy to any cloud with a single command using AI-powered automation</p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all">
              <div className="p-3 bg-blue-500/20 rounded-lg w-fit mx-auto mb-4">
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Self-Healing</h3>
              <p className="text-gray-400">Automatically detect and fix issues before they impact your users</p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all">
              <div className="p-3 bg-green-500/20 rounded-lg w-fit mx-auto mb-4">
                <Cpu className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Smart Scaling</h3>
              <p className="text-gray-400">Optimize costs and performance with intelligent auto-scaling</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
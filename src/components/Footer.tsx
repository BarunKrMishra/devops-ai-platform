import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Linkedin } from 'lucide-react';
import AikyaLogo from './brand/AikyaLogo';

const Footer: React.FC = () => {
  return (
    <footer className="py-16 px-6 border-t border-white/10">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <AikyaLogo textClassName="text-white" />
            <p className="text-slate-400 leading-relaxed">
              Aikya brings unity to DevOps with AI-led orchestration, calm releases, and resilient infrastructure.
            </p>
            <div className="flex space-x-4">
              <a href="https://github.com" className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                <Github className="h-5 w-5" />
              </a>
              <a href="https://twitter.com" className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://linkedin.com" className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <Link to={{ pathname: '/', hash: '#features' }} className="hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link to="/enterprise" className="hover:text-white transition-colors">Enterprise</Link></li>
              <li><Link to="/integrations" className="hover:text-white transition-colors">Integrations</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2 text-slate-400">
              <li><Link to="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              <li><Link to="/api-reference" className="hover:text-white transition-colors">API Reference</Link></li>
              <li><Link to="/tutorials" className="hover:text-white transition-colors">Tutorials</Link></li>
              <li><Link to="/community" className="hover:text-white transition-colors">Community</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-slate-400">
              <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              <li><Link to="/careers" className="hover:text-white transition-colors">Careers</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link to="/feedback" className="hover:text-white transition-colors">Feedback</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-slate-400 text-sm">
            (c) 2024 Aikya. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0 text-sm text-slate-400">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link to="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;






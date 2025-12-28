import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const FinalCTA: React.FC = () => {
  return (
    <section className="px-6 pb-24">
      <div className="container mx-auto">
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-teal-500/15 rounded-2xl p-10 border border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div>
              <h3 className="text-3xl font-display text-white">Bring Aikya into your release flow.</h3>
              <p className="text-slate-300 mt-3 max-w-2xl">
                Start with a free trial or talk to our team about a tailored rollout. We are ready to help you ship with calm confidence.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/login"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 text-white hover:from-amber-600 hover:to-teal-600 transition-all inline-flex items-center gap-2 justify-center"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="mailto:aikya.devops@gmail.com?subject=Aikya%20demo%20request"
                className="px-6 py-3 rounded-xl border border-white/10 text-white hover:bg-white/10 transition-all inline-flex items-center gap-2 justify-center"
              >
                Email for demo
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;

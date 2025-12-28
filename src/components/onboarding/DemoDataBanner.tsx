import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const DemoDataBanner: React.FC = () => {
  const { onboarding } = useAuth();

  if (!onboarding) {
    return null;
  }

  if (onboarding.demo_mode === false) {
    return null;
  }

  const isCompleted = onboarding.completed;
  const messageTitle = isCompleted
    ? 'Connect integrations to go live.'
    : 'Demo data is currently shown.';
  const messageBody = isCompleted
    ? 'Send your requirements to unlock real-time workflows and live metrics.'
    : 'Complete onboarding to unlock live data and tailored features.';
  const ctaLabel = 'Complete onboarding';
  const ctaTo = '/onboarding';

  return (
    <div className="pt-20 bg-amber-500/10 border-b border-amber-500/30">
      <div className="container mx-auto px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3 text-amber-200">
          <AlertTriangle className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-semibold text-white">{messageTitle}</p>
            <p className="text-sm text-amber-200/90">{messageBody}</p>
          </div>
        </div>
        {!isCompleted && (
          <Link
            to={ctaTo}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-all text-sm text-center"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
};

export default DemoDataBanner;

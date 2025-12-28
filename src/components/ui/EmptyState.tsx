import React from 'react';
import { Sparkles } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  message: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
};

const EmptyState: React.FC<EmptyStateProps> = ({ title, message, icon: Icon, action }) => {
  const DisplayIcon = Icon || Sparkles;
  return (
    <div className="text-center py-12 px-6 bg-white/5 border border-white/10 rounded-2xl">
      <DisplayIcon className="h-10 w-10 text-amber-300 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 max-w-xl mx-auto">{message}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
};

export default EmptyState;

import React from 'react';
import { Shield, Lock, FileCheck } from 'lucide-react';

const Security: React.FC = () => {
  const items = [
    {
      title: 'Security by default',
      description: 'Encryption in transit and at rest with role-based access.',
      icon: Lock
    },
    {
      title: 'Audit-ready evidence',
      description: 'Every deployment and change is logged, searchable, and exportable.',
      icon: FileCheck
    },
    {
      title: 'Governed automation',
      description: 'Release gates, approvals, and policy checks in one place.',
      icon: Shield
    }
  ];

  return (
    <section className="px-6 pb-20">
      <div className="container mx-auto">
        <div className="glass rounded-2xl p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Security</p>
              <h3 className="text-3xl font-display text-white mt-3">Compliance without the chaos.</h3>
            </div>
            <p className="text-slate-300 max-w-xl">
              Aikya keeps your governance posture strong while your teams move fast.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {items.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 p-6 bg-white/5">
                <item.icon className="h-6 w-6 text-amber-300" />
                <h4 className="text-xl font-semibold text-white mt-4">{item.title}</h4>
                <p className="text-slate-300 mt-2">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Security;

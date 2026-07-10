import React from 'react';
import { ShieldCheck, Lock, KeyRound, Building2, ScrollText, Fingerprint } from 'lucide-react';
import { useContent } from '../../contexts/ContentContext';
import { getIcon } from '../../utils/iconMap';

// Real, built-in security controls (verified in the platform).
const SECURITY_FACTS: { icon: React.ElementType; label: string }[] = [
  { icon: Lock, label: 'AES-256-GCM encryption' },
  { icon: KeyRound, label: 'OTP on every login' },
  { icon: Fingerprint, label: 'Role-based access' },
  { icon: Building2, label: 'Per-org data isolation' },
  { icon: ScrollText, label: 'Full audit trail' },
  { icon: ShieldCheck, label: 'HMAC-signed webhooks' }
];

const Security: React.FC = () => {
  const { content } = useContent();
  const security = content.landing.security;
  const items = security.items || [];

  return (
    <section id="security" className="px-6 pb-20">
      <div className="container mx-auto">
        <div className="glass rounded-2xl p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-amber-300">{security.kicker}</p>
              <h3 className="text-3xl font-display text-white mt-3">{security.title}</h3>
            </div>
            <p className="text-slate-300 max-w-xl">{security.subtitle}</p>
          </div>

          {/* Real security controls, at a glance */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {SECURITY_FACTS.map((fact) => (
              <div key={fact.label} className="flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <fact.icon className="h-5 w-5 text-teal-300" />
                <span className="text-xs text-slate-300 leading-snug">{fact.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3 [perspective:1200px]">
            {items.map((item) => {
              const Icon = getIcon(item.icon);
              return (
                <div key={item.title} className="aikya-tilt rounded-2xl border border-white/10 p-6 bg-white/5 hover:bg-white/[0.08] hover:border-amber-400/30">
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500/25 to-teal-500/15 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-amber-200" />
                  </div>
                  <h4 className="text-xl font-semibold text-white mt-4">{item.title}</h4>
                  <p className="text-slate-300 mt-2">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Security;

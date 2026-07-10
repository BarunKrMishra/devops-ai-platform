import React from 'react';
import { useContent } from '../../contexts/ContentContext';

// The real tools Aikya connects to (these map to actual supported providers).
const INTEGRATIONS: { name: string; color: string }[] = [
  { name: 'GitHub', color: '#e6edf3' },
  { name: 'GitLab', color: '#fc6d26' },
  { name: 'Jenkins', color: '#d33833' },
  { name: 'AWS', color: '#ff9900' },
  { name: 'Azure', color: '#3ba7f0' },
  { name: 'GCP', color: '#4285f4' },
  { name: 'Kubernetes', color: '#326ce5' },
  { name: 'Terraform', color: '#7b42bc' },
  { name: 'Datadog', color: '#a05eb5' },
  { name: 'Prometheus', color: '#e6522c' },
  { name: 'Grafana', color: '#f46800' },
  { name: 'Slack', color: '#36c5f0' },
  { name: 'PagerDuty', color: '#06ac38' },
  { name: 'Jira', color: '#2684ff' },
  { name: 'ClickUp', color: '#7b68ee' },
  { name: 'HubSpot', color: '#ff7a59' },
  { name: 'Salesforce', color: '#00a1e0' },
  { name: 'Zendesk', color: '#03363d' },
  { name: 'Intercom', color: '#1f8ded' },
  { name: 'Gmail', color: '#ea4335' },
  { name: 'Outlook', color: '#0a6cff' },
  { name: 'Twilio', color: '#f22f46' },
  { name: 'Stripe', color: '#635bff' },
  { name: 'Razorpay', color: '#3395ff' },
  { name: 'QuickBooks', color: '#2ca01c' },
  { name: 'Shopify', color: '#95bf47' }
];

const marqueeStyles = `
.aikya-marquee { position: relative; overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
.aikya-marquee-track { display: flex; width: max-content; gap: 12px; will-change: transform; }
.aikya-marquee-track.rtl { animation: aikya-marq 46s linear infinite; }
.aikya-marquee-track.ltr { animation: aikya-marq 52s linear infinite reverse; }
.aikya-marquee:hover .aikya-marquee-track { animation-play-state: paused; }
@keyframes aikya-marq { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.aikya-chip { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); white-space: nowrap; font-weight: 600; font-size: 0.9rem; color: #cbd5e1; }
.aikya-chip .dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
@media (prefers-reduced-motion: reduce) { .aikya-marquee-track.rtl, .aikya-marquee-track.ltr { animation: none; } }
`;

const Row: React.FC<{ items: typeof INTEGRATIONS; dir: 'rtl' | 'ltr' }> = ({ items, dir }) => (
  <div className="aikya-marquee">
    <div className={`aikya-marquee-track ${dir}`}>
      {[...items, ...items].map((it, i) => (
        <span className="aikya-chip" key={`${it.name}-${i}`}>
          <span className="dot" style={{ background: it.color, color: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  </div>
);

const TrustBar: React.FC = () => {
  const { content } = useContent();
  const trust = content.landing.trust;
  const sectors = trust.tags || [];
  const half = Math.ceil(INTEGRATIONS.length / 2);

  return (
    <section className="px-6 pb-14">
      <style>{marqueeStyles}</style>
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{trust.kicker}</p>
          <h3 className="text-2xl md:text-3xl font-display text-white mt-3">{trust.title}</h3>
          <p className="text-slate-400 mt-2 max-w-2xl mx-auto">{trust.subtitle}</p>
        </div>

        <div className="space-y-3">
          <Row items={INTEGRATIONS.slice(0, half)} dir="rtl" />
          <Row items={INTEGRATIONS.slice(half)} dir="ltr" />
        </div>

        {sectors.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500 mr-1">Serving</span>
            {sectors.map((sector) => (
              <span key={sector} className="px-3 py-1 rounded-full border border-white/10 text-slate-300 text-xs bg-white/5">
                {sector}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TrustBar;

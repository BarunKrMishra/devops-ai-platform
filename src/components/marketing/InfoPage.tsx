import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import Header from '../Header';
import Footer from '../Footer';

type InfoSection = {
  title: string;
  body: string;
  bullets?: string[];
};

type PricingTier = {
  name: string;
  price: string;
  description: string;
  features: string[];
  ctaLabel?: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type InfoPageProps = {
  title: string;
  subtitle: string;
  highlights?: string[];
  sections?: InfoSection[];
  pricingTiers?: PricingTier[];
  faq?: FaqItem[];
  ctaLabel?: string;
  ctaTo?: string;
  secondaryCtaLabel?: string;
  secondaryCtaTo?: string;
  contactEmail?: string;
  contactSubject?: string;
  contactCtaLabel?: string;
};

const defaultHighlights = [
  'Unified control for pipelines and infrastructure',
  'AI-guided workflows that stay audit-ready',
  'Global-ready resilience with calm operations'
];

const InfoPage: React.FC<InfoPageProps> = ({
  title,
  subtitle,
  highlights = defaultHighlights,
  sections = [],
  pricingTiers,
  faq,
  ctaLabel = 'Start with Aikya',
  ctaTo = '/login',
  secondaryCtaLabel = 'Back to home',
  secondaryCtaTo = '/',
  contactEmail,
  contactSubject = 'Aikya inquiry',
  contactCtaLabel = 'Email Aikya'
}) => {
  const renderCta = (to: string, label: string, className: string) => {
    const isExternal = to.startsWith('http') || to.startsWith('mailto:');
    if (isExternal) {
      return (
        <a href={to} className={className}>
          {label}
          <ArrowRight className="h-4 w-4" />
        </a>
      );
    }

    return (
      <Link to={to} className={className}>
        {label}
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  };

  const contactHref = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(contactSubject)}`
    : '';

  return (
    <div className="min-h-screen bg-aikya">
      <Header />
      <main className="pt-32 pb-20 px-6">
        <div className="container mx-auto">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm text-amber-200">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Aikya Platform
            </div>
            <h1 className="text-4xl md:text-6xl font-display text-white mt-6">{title}</h1>
            <p className="text-lg md:text-xl text-slate-300 mt-4">{subtitle}</p>
          </div>

          {highlights.length > 0 && (
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {highlights.map((item, index) => (
                <div key={index} className="glass rounded-2xl p-6">
                  <p className="text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          )}

          {pricingTiers && pricingTiers.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-display text-white mb-6">Plans</h2>
              <div className="grid gap-6 lg:grid-cols-3">
                {pricingTiers.map((tier) => (
                  <div key={tier.name} className="glass rounded-2xl p-6 flex flex-col">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-white">{tier.name}</h3>
                      <span className="text-amber-200 font-medium">{tier.price}</span>
                    </div>
                    <p className="text-slate-300 mt-3">{tier.description}</p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-300">
                      {tier.features.map((feature) => (
                        <li key={feature}>- {feature}</li>
                      ))}
                    </ul>
                    <Link
                      to={ctaTo}
                      className="mt-6 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all"
                    >
                      {tier.ctaLabel || ctaLabel}
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {sections.length > 0 && (
            <section className="mt-16 space-y-10">
              {sections.map((section) => (
                <div key={section.title} className="glass rounded-2xl p-6">
                  <h3 className="text-xl font-semibold text-white">{section.title}</h3>
                  <p className="text-slate-300 mt-3">{section.body}</p>
                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="mt-4 space-y-2 text-sm text-slate-300">
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>- {bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )}

          {faq && faq.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-display text-white mb-6">FAQ</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {faq.map((item) => (
                  <div key={item.question} className="glass rounded-2xl p-6">
                    <h4 className="text-lg font-semibold text-white">{item.question}</h4>
                    <p className="text-slate-300 mt-3">{item.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {contactEmail && (
            <section className="mt-16 glass rounded-2xl p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h3 className="text-2xl font-display text-white">Talk to the Aikya team</h3>
                <p className="text-slate-300 mt-2">
                  Send us a message and we will respond within one business day.
                </p>
                <p className="text-slate-400 mt-2">Email: {contactEmail}</p>
              </div>
              {renderCta(
                contactHref,
                contactCtaLabel,
                'px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 text-white hover:from-amber-600 hover:to-teal-600 transition-all inline-flex items-center gap-2'
              )}
            </section>
          )}

          <div className="mt-16 flex flex-col sm:flex-row gap-4">
            <Link
              to={secondaryCtaTo}
              className="px-6 py-3 rounded-xl border border-white/10 text-white hover:bg-white/10 transition-all"
            >
              {secondaryCtaLabel}
            </Link>
            {renderCta(
              ctaTo,
              ctaLabel,
              'px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 text-white hover:from-amber-600 hover:to-teal-600 transition-all inline-flex items-center gap-2'
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default InfoPage;

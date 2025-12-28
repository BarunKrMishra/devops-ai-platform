import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/auth/LoginPage';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import Dashboard from './components/Dashboard';
import Footer from './components/Footer';
import TrustBar from './components/landing/TrustBar';
import MetricsPulse from './components/landing/MetricsPulse';
import UseCases from './components/landing/UseCases';
import Workflow from './components/landing/Workflow';
import Security from './components/landing/Security';
import FinalCTA from './components/landing/FinalCTA';
import CICDSetupPage from './components/cicd/CICDSetupPage';
import InfrastructureManagementPage from './components/infrastructure/InfrastructureManagementPage';
import MonitoringPage from './components/monitoring/MonitoringPage';
import AuditLogsPage from './components/audit/AuditLogsPage';
import UserSettingsPage from './components/settings/UserSettingsPage';
import TemplateGalleryPage from './components/templates/TemplateGalleryPage';
import TeamCollaborationPage from './components/collaboration/TeamCollaborationPage';
import AcceptInvitePage from './components/collaboration/AcceptInvitePage';
import PredictiveAnalyticsPage from './components/analytics/PredictiveAnalyticsPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import InfoPage from './components/marketing/InfoPage';
import GitHubCallbackPage from './components/auth/GitHubCallbackPage';
import DemoDataBanner from './components/onboarding/DemoDataBanner';
import OnboardingPage from './components/onboarding/OnboardingPage';
import IntegrationsHubPage from './components/integrations/IntegrationsHubPage';

const marketingPages = [
  {
    path: '/pricing',
    title: 'Pricing',
    subtitle: 'Transparent plans for teams that want unified DevOps without noise.',
    highlights: [
      'Per-user pricing with predictable monthly billing',
      'AI task packs for burst automation',
      '14-day free trial with full platform access'
    ],
    pricingTiers: [
      {
        name: 'Starter',
        price: '$29 per user / month',
        description: 'Perfect for early teams building reliable release habits.',
        features: [
          'Up to 3 environments',
          'Core CI/CD orchestration',
          'Standard alerting and metrics',
          'Community support'
        ],
        ctaLabel: 'Start Starter'
      },
      {
        name: 'Scale',
        price: '$79 per user / month',
        description: 'For growing teams that need advanced automation and insights.',
        features: [
          'Unlimited environments',
          'Predictive guardrails',
          'AI optimization reports',
          'Priority email support'
        ],
        ctaLabel: 'Start Scale'
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        description: 'Tailored for large organizations with strict governance.',
        features: [
          'SSO and SCIM provisioning',
          'Dedicated success manager',
          'Custom SLAs and audits',
          'Private network options'
        ],
        ctaLabel: 'Talk to sales'
      }
    ],
    sections: [
      {
        title: 'Add-ons and usage',
        body: 'Aikya uses usage packs for heavy AI workloads and high-frequency deployments.',
        bullets: [
          'AI task packs at $99 per 10k actions',
          'Premium monitoring at $49 per service',
          'Audit archive retention at $15 per month'
        ]
      },
      {
        title: 'Billing and security',
        body: 'All plans include encryption at rest and in transit with flexible billing options.',
        bullets: [
          'Monthly or annual billing',
          'Invoice and PO support for Scale and Enterprise',
          'SOC 2-aligned controls for critical data'
        ]
      }
    ],
    faq: [
      {
        question: 'Can I change plans later?',
        answer: 'Yes. Upgrade or downgrade at any time. Changes are prorated automatically.'
      },
      {
        question: 'Do you offer a free trial?',
        answer: 'Yes. The 14-day trial includes full platform access and starter integrations.'
      },
      {
        question: 'Is there a self-hosted option?',
        answer: 'Enterprise customers can request private network or self-hosted deployments.'
      }
    ],
    ctaLabel: 'Start free trial',
    ctaTo: '/login',
    secondaryCtaLabel: 'Contact sales',
    secondaryCtaTo: '/contact'
  },
  {
    path: '/enterprise',
    title: 'Enterprise',
    subtitle: 'Governance, security, and scale without losing the calm Aikya experience.',
    highlights: [
      'Single sign-on with SCIM provisioning',
      'Audit-grade reporting and evidence exports',
      'Dedicated support and onboarding'
    ],
    sections: [
      {
        title: 'Security and compliance',
        body: 'Aikya keeps enterprise controls aligned with modern compliance needs.',
        bullets: [
          'SSO, SCIM, and role-based access control',
          'Audit logs with exportable evidence packs',
          'Data residency options by region'
        ]
      },
      {
        title: 'Operational reliability',
        body: 'Scale confidently with safeguards for critical workflows.',
        bullets: [
          'Release gates and approval workflows',
          'Private networking and IP allowlists',
          'Custom SLAs with 24/7 support'
        ]
      },
      {
        title: 'Enterprise onboarding',
        body: 'Aikya teams help you migrate, configure, and operationalize quickly.',
        bullets: [
          'Dedicated success manager',
          'Architecture review sessions',
          'Training and enablement workshops'
        ]
      }
    ],
    ctaLabel: 'Book enterprise demo',
    ctaTo: '/contact'
  },
  {
    path: '/integrations',
    title: 'Integrations',
    subtitle: 'Connect Aikya with the tools you already trust.',
    highlights: [
      'Git, cloud, and infra tools in minutes',
      'Observability and incident workflows',
      'Chat-driven automations for faster teams'
    ],
    sections: [
      {
        title: 'Source control',
        body: 'Sync release workflows directly from your repositories.',
        bullets: ['GitHub Actions', 'GitLab CI', 'Bitbucket Pipelines']
      },
      {
        title: 'Cloud and infrastructure',
        body: 'Automate provisioning and release gates across environments.',
        bullets: ['AWS', 'GCP', 'Azure', 'Terraform', 'Kubernetes']
      },
      {
        title: 'Observability and response',
        body: 'Connect telemetry to automated response flows.',
        bullets: ['Datadog', 'New Relic', 'Grafana', 'PagerDuty', 'Opsgenie']
      },
      {
        title: 'Collaboration',
        body: 'Stay aligned with chat-first workflows.',
        bullets: ['Slack', 'Microsoft Teams', 'Linear', 'Jira']
      }
    ],
    ctaLabel: 'Request integration',
    ctaTo: '/contact'
  },
  {
    path: '/docs',
    title: 'Documentation',
    subtitle: 'Guides and references for every Aikya workflow.',
    highlights: [
      'Quickstarts for CI/CD and infrastructure',
      'Security and access setup',
      'Operational playbooks and runbooks'
    ],
    sections: [
      {
        title: 'Getting started',
        body: 'Stand up Aikya in under an hour with guided onboarding.',
        bullets: [
          'Connect your source repository',
          'Create your first pipeline',
          'Configure alerts and guardrails'
        ]
      },
      {
        title: 'Infrastructure management',
        body: 'Manage resources, templates, and environments without drift.',
        bullets: [
          'Infrastructure templates',
          'Environment variables and secrets',
          'Audit-ready change history'
        ]
      },
      {
        title: 'AI operations',
        body: 'Leverage Aikya AI for release automation and incident response.',
        bullets: [
          'Prompted deployment actions',
          'Predictive analytics',
          'Auto-healing playbooks'
        ]
      }
    ],
    ctaLabel: 'Open the docs',
    ctaTo: '/docs'
  },
  {
    path: '/api-reference',
    title: 'API Reference',
    subtitle: 'Full control of Aikya workflows with secure APIs.',
    highlights: [
      'REST and webhook-first automation',
      'Token-based authentication',
      'Rate limits designed for scale'
    ],
    sections: [
      {
        title: 'Authentication',
        body: 'Use bearer tokens scoped to organization and environment.',
        bullets: [
          'Token rotation and revocation',
          'Scoped access per environment',
          'Audit trails for every API call'
        ]
      },
      {
        title: 'Core endpoints',
        body: 'Automate deployments, infrastructure, and monitoring.',
        bullets: [
          'POST /api/cicd/pipeline',
          'POST /api/monitoring/alerts',
          'GET /api/health'
        ]
      },
      {
        title: 'Webhooks',
        body: 'Notify Aikya when external systems change.',
        bullets: [
          'Deployment status updates',
          'Incident creation',
          'Configuration sync'
        ]
      }
    ],
    ctaLabel: 'Generate API token',
    ctaTo: '/settings'
  },
  {
    path: '/tutorials',
    title: 'Tutorials',
    subtitle: 'Step-by-step journeys to master Aikya.',
    highlights: [
      'From first deploy to autoscaling',
      'Runbooks for incident response',
      'AI automation in real scenarios'
    ],
    sections: [
      {
        title: 'Launch a multi-cloud pipeline',
        body: 'Build a release flow that works across clouds with minimal effort.',
        bullets: [
          'Connect repositories',
          'Define environments',
          'Add release guardrails'
        ]
      },
      {
        title: 'Automate a rollback',
        body: 'Configure safe rollbacks that trigger when metrics degrade.',
        bullets: [
          'Set thresholds',
          'Define rollback playbooks',
          'Notify the team automatically'
        ]
      },
      {
        title: 'AI-driven cost review',
        body: 'Use Aikya insights to reduce spend every month.',
        bullets: [
          'Enable cost snapshots',
          'Review AI recommendations',
          'Apply savings playbooks'
        ]
      }
    ],
    ctaLabel: 'Start tutorial',
    ctaTo: '/login'
  },
  {
    path: '/community',
    title: 'Community',
    subtitle: 'Build with teams who keep Aikya calm in production.',
    highlights: [
      'Weekly community calls and demos',
      'Open templates and playbooks',
      'Regional meetups and workshops'
    ],
    sections: [
      {
        title: 'Connect with builders',
        body: 'Learn from engineers, SREs, and DevOps leaders.',
        bullets: [
          'Join the Aikya Slack',
          'Share infrastructure templates',
          'Participate in feedback sessions'
        ]
      },
      {
        title: 'Events',
        body: 'Stay up to date with live workshops and AMAs.',
        bullets: [
          'Monthly release deep-dives',
          'Quarterly roadmap briefings',
          'Community spotlight sessions'
        ]
      }
    ],
    ctaLabel: 'Join the community',
    ctaTo: '/contact'
  },
  {
    path: '/about',
    title: 'About Aikya',
    subtitle: 'We bring harmony to modern DevOps teams worldwide.',
    highlights: [
      'Built by engineers who run critical infrastructure',
      'Focus on calm, reliable deployments',
      'Global-first with local support options'
    ],
    sections: [
      {
        title: 'Our mission',
        body: 'Aikya exists to make DevOps calm, predictable, and unified.',
        bullets: [
          'Reduce deployment anxiety',
          'Align teams with shared automation',
          'Deliver resilient infrastructure faster'
        ]
      },
      {
        title: 'Our values',
        body: 'We value clarity, resilience, and community-driven feedback.',
        bullets: [
          'Calm over chaos',
          'Security by default',
          'Respect for global teams'
        ]
      }
    ],
    ctaLabel: 'Talk to us',
    ctaTo: '/contact'
  },
  {
    path: '/blog',
    title: 'Aikya Blog',
    subtitle: 'Insights on DevOps, AI operations, and infrastructure.',
    highlights: [
      'Release notes and product updates',
      'Operational playbooks',
      'AI-driven automation research'
    ],
    sections: [
      {
        title: 'Latest topics',
        body: 'A snapshot of what our team is building and learning.',
        bullets: [
          'Predictive guardrails for CI/CD',
          'Incident response without toil',
          'Scaling multi-cloud pipelines'
        ]
      }
    ],
    ctaLabel: 'Subscribe for updates',
    ctaTo: '/contact'
  },
  {
    path: '/careers',
    title: 'Careers',
    subtitle: 'Help us craft the calmest DevOps platform in the world.',
    highlights: [
      'Remote-friendly teams',
      'Meaningful infrastructure challenges',
      'Learning-first culture'
    ],
    sections: [
      {
        title: 'Open roles',
        body: 'We are hiring across engineering, product, and GTM.',
        bullets: [
          'Full-stack engineer',
          'DevOps platform engineer',
          'Customer success lead'
        ]
      },
      {
        title: 'Life at Aikya',
        body: 'We build with empathy for people and systems.',
        bullets: [
          'Flexible work hours',
          'Learning stipend and mentorship',
          'Wellness and team retreats'
        ]
      }
    ],
    ctaLabel: 'Apply now',
    ctaTo: '/contact'
  },
  {
    path: '/contact',
    title: 'Contact',
    subtitle: 'We are ready to talk about your deployment goals.',
    highlights: [
      'Response within 1 business day',
      'Dedicated onboarding for new teams',
      'Support for enterprise requirements'
    ],
    sections: [
      {
        title: 'Sales and support',
        body: 'Reach the team directly for demos, pricing, or technical questions.',
        bullets: [
          'Email: aikya.devops@gmail.com',
          'Hours: Mon-Fri, 9:00 AM to 6:00 PM IST',
          'Emergency escalation available for Enterprise'
        ]
      },
      {
        title: 'Partner with us',
        body: 'We collaborate with SI partners and cloud consultancies.',
        bullets: [
          'Co-marketing opportunities',
          'Joint delivery programs',
          'Referral incentives'
        ]
      }
    ],
    ctaLabel: 'Email Aikya',
    ctaTo: 'mailto:aikya.devops@gmail.com?subject=Aikya%20inquiry',
    contactEmail: 'aikya.devops@gmail.com',
    contactSubject: 'Aikya inquiry',
    contactCtaLabel: 'Mail us'
  },
  {
    path: '/feedback',
    title: 'Feedback & Bug Reports',
    subtitle: 'Help us make Aikya stronger by sharing product feedback and issues.',
    highlights: [
      'We respond within 1 business day',
      'Bug reports go straight to engineering triage',
      'Feature feedback influences the roadmap'
    ],
    sections: [
      {
        title: 'Product feedback',
        body: 'Tell us what is working, what feels missing, and what would make your workflows smoother.',
        bullets: [
          'Share workflow friction points',
          'Request new integrations',
          'Suggest AI improvements'
        ]
      },
      {
        title: 'Bug reports',
        body: 'Found a bug? Send us the steps to reproduce and any screenshots or logs.',
        bullets: [
          'Include browser/OS details',
          'Describe expected vs actual behavior',
          'Add timestamps if possible'
        ]
      }
    ],
    ctaLabel: 'Send feedback',
    ctaTo: 'mailto:aikya.devops@gmail.com?subject=Aikya%20feedback%20or%20bug%20report',
    contactEmail: 'aikya.devops@gmail.com',
    contactSubject: 'Aikya feedback or bug report',
    contactCtaLabel: 'Email feedback'
  },
  {
    path: '/privacy',
    title: 'Privacy Policy',
    subtitle: 'How Aikya protects your data and respects your privacy.',
    highlights: [
      'Minimal data collection',
      'Encryption by default',
      'Clear data retention timelines'
    ],
    sections: [
      {
        title: 'Data we collect',
        body: 'Aikya collects only what is necessary to deliver the platform.',
        bullets: [
          'Account and organization details',
          'Deployment metadata and audit logs',
          'Usage analytics with opt-out options'
        ]
      },
      {
        title: 'Data retention',
        body: 'Retention policies are configurable by plan and region.',
        bullets: [
          'Default 90-day log retention',
          'Configurable retention for Enterprise',
          'Secure deletion on request'
        ]
      }
    ],
    ctaLabel: 'Contact privacy team',
    ctaTo: '/contact'
  },
  {
    path: '/terms',
    title: 'Terms of Service',
    subtitle: 'The terms that guide how Aikya is delivered worldwide.',
    highlights: [
      'Transparent service commitments',
      'Clear account responsibilities',
      'Fair usage policies'
    ],
    sections: [
      {
        title: 'Service access',
        body: 'Aikya provides the platform as a subscription service.',
        bullets: [
          'Accounts are managed by organization admins',
          'Service uptime commitments vary by plan',
          'Support response times are published per tier'
        ]
      },
      {
        title: 'Acceptable use',
        body: 'Keep the platform secure and reliable for everyone.',
        bullets: [
          'No abusive automation or spam',
          'Protect access tokens and credentials',
          'Report security incidents promptly'
        ]
      }
    ],
    ctaLabel: 'Review contract',
    ctaTo: '/contact'
  },
  {
    path: '/cookies',
    title: 'Cookie Policy',
    subtitle: 'A simple view of how Aikya uses cookies and analytics.',
    highlights: [
      'Essential cookies for sessions',
      'Optional analytics cookies',
      'Clear opt-out settings'
    ],
    sections: [
      {
        title: 'Essential cookies',
        body: 'Used for authentication and session continuity.',
        bullets: [
          'Session ID',
          'CSRF protection tokens',
          'Load balancing preferences'
        ]
      },
      {
        title: 'Analytics cookies',
        body: 'Help us understand product usage to improve the experience.',
        bullets: [
          'Page interaction metrics',
          'Feature adoption tracking',
          'Error monitoring'
        ]
      }
    ],
    ctaLabel: 'Manage preferences',
    ctaTo: '/settings'
  }
];

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-aikya flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400"></div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-aikya flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400"></div>
      </div>
    );
  }
  
  return user ? <Navigate to="/dashboard" /> : <>{children}</>;
};

const ScrollToHash: React.FC = () => {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [hash, pathname]);

  return null;
};

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-aikya">
      <Header />
      <Hero />
      <TrustBar />
      <MetricsPulse />
      <Features />
      <UseCases />
      <Workflow />
      <Security />
      <FinalCTA />
      <Footer />
    </div>
  );
};

const ProtectedShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-aikya">
      <Header />
      <DemoDataBanner />
      {children}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToHash />
        <Routes>
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />

          <Route path="/accept-invite" element={
            <PublicRoute>
              <AcceptInvitePage />
            </PublicRoute>
          } />
          
          <Route path="/" element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          } />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <ProtectedShell>
                <Dashboard />
              </ProtectedShell>
            </ProtectedRoute>
          } />
          
          <Route path="/cicd" element={
            <ProtectedRoute>
              <ProtectedShell>
                <CICDSetupPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />
          
          <Route path="/infrastructure" element={
            <ProtectedRoute>
              <ProtectedShell>
                <InfrastructureManagementPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />
          
          <Route path="/monitoring" element={
            <ProtectedRoute>
              <ProtectedShell>
                <MonitoringPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />
          
          <Route path="/audit" element={
            <ProtectedRoute>
              <ProtectedShell>
                <AuditLogsPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute>
              <ProtectedShell>
                <UserSettingsPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          <Route path="/templates" element={
            <ProtectedRoute>
              <ProtectedShell>
                <TemplateGalleryPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          <Route path="/app/integrations" element={
            <ProtectedRoute>
              <ProtectedShell>
                <IntegrationsHubPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          <Route path="/collaboration" element={
            <ProtectedRoute>
              <ProtectedShell>
                <TeamCollaborationPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          <Route path="/analytics" element={
            <ProtectedRoute>
              <ProtectedShell>
                <PredictiveAnalyticsPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          <Route path="/forgot-password" element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          } />
          
          <Route path="/auth/github/callback" element={
            <PublicRoute>
              <GitHubCallbackPage />
            </PublicRoute>
          } />

          <Route path="/onboarding" element={
            <ProtectedRoute>
              <ProtectedShell>
                <OnboardingPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          {marketingPages.map((page) => (
            <Route
              key={page.path}
              path={page.path}
              element={<InfoPage {...page} />}
            />
          ))}
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const accountTypes = [
  { value: 'individual', label: 'Individual' },
  { value: 'startup', label: 'Startup' },
  { value: 'enterprise', label: 'Enterprise' }
];

const teamSizes = ['1', '2-10', '11-50', '51-200', '200+'];

const roles = ['DevOps', 'Engineering', 'Product', 'Founder', 'Security'];

const useCaseOptions = [
  'CI/CD',
  'Infrastructure automation',
  'Monitoring',
  'Cost optimization',
  'Compliance'
];

const cloudOptions = ['AWS', 'Azure', 'GCP', 'Multi-cloud'];

const securityOptions = ['SOC2', 'ISO', 'HIPAA', 'GDPR', 'None'];

const OnboardingPage: React.FC = () => {
  const { onboarding, refreshOnboarding } = useAuth();
  const [accountType, setAccountType] = useState('startup');
  const [organizationName, setOrganizationName] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [role, setRole] = useState('');
  const [useCases, setUseCases] = useState<string[]>([]);
  const [clouds, setClouds] = useState<string[]>([]);
  const [securityRequirements, setSecurityRequirements] = useState<string[]>([]);
  const [securityContactEmail, setSecurityContactEmail] = useState('');
  const [aiIntegration, setAiIntegration] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const profile = onboarding?.profile;

  useEffect(() => {
    if (profile) {
      setAccountType(profile.account_type || 'startup');
      setOrganizationName(profile.organization_name || '');
      setCompanyDomain(profile.company_domain || '');
      setTeamSize(profile.team_size || '');
      setRole(profile.role || '');
      setUseCases(profile.use_cases || []);
      setClouds(profile.clouds || []);
      setSecurityRequirements(profile.security_requirements || []);
      setSecurityContactEmail(profile.security_contact_email || '');
      setAiIntegration(Boolean(profile.ai_integration));
      setConsentTerms(Boolean(profile.consent_terms));
      setConsentPrivacy(Boolean(profile.consent_privacy));
    }
  }, [profile]);

  const toggleValue = (value: string, list: string[], setList: (items: string[]) => void) => {
    if (list.includes(value)) {
      setList(list.filter((item) => item !== value));
    } else {
      setList([...list, value]);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!organizationName.trim()) {
      setError('Organization name is required.');
      return;
    }

    if (!companyDomain.trim()) {
      setError('Company domain is required.');
      return;
    }

    if (!teamSize || !role) {
      setError('Please select a team size and role.');
      return;
    }

    if (useCases.length === 0) {
      setError('Select at least one use case.');
      return;
    }

    if (clouds.length === 0) {
      setError('Select at least one primary cloud.');
      return;
    }

    if (securityRequirements.length === 0) {
      setError('Select at least one security requirement.');
      return;
    }

    if (!securityContactEmail.trim()) {
      setError('Security contact email is required.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(securityContactEmail.trim())) {
      setError('Security contact email is invalid.');
      return;
    }

    if (!consentTerms || !consentPrivacy) {
      setError('Please accept the terms and privacy policy.');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/onboarding`, {
        account_type: accountType,
        organization_name: organizationName.trim(),
        company_domain: companyDomain.trim(),
        team_size: teamSize,
        role,
        use_cases: useCases,
        clouds,
        security_requirements: securityRequirements,
        security_contact_email: securityContactEmail.trim(),
        ai_integration: aiIntegration,
        consent_terms: consentTerms,
        consent_privacy: consentPrivacy
      });

      await refreshOnboarding();
      setSuccess('Thanks! Your onboarding details are saved. Live data access is now unlocked.');
    } catch (submitError: any) {
      setError(submitError.response?.data?.error || 'Failed to save onboarding details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-aikya">
      <div className="container mx-auto px-6 py-10">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-display text-white">Onboarding for Live Data</h1>
          <p className="text-slate-300 mt-3">
            You are viewing demo data right now. Share a few details to unlock live data and tailored
            features for your organization.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 glass rounded-2xl p-8 space-y-8">
          <p className="text-sm text-slate-400">Fields marked with * are required.</p>
          {success && (
            <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-300">
              <CheckCircle className="h-5 w-5 mt-0.5" />
              <p>{success}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300">
              {error}
            </div>
          )}

          <div>
            <h2 className="text-xl font-semibold text-white">Account type *</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {accountTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setAccountType(type.value)}
                  className={`px-4 py-3 rounded-xl border transition-all ${
                    accountType === type.value
                      ? 'border-amber-400 bg-amber-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="text-sm text-slate-300">Organization name *</label>
              <input
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                placeholder="Aikya Labs"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Company domain *</label>
              <input
                value={companyDomain}
                onChange={(event) => setCompanyDomain(event.target.value)}
                className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                placeholder="aikya.io"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Team size *</label>
              <select
                value={teamSize}
                onChange={(event) => setTeamSize(event.target.value)}
                className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="">Select team size</option>
                {teamSizes.map((size) => (
                  <option key={size} value={size} className="text-slate-100">
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-300">Your role *</label>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="">Select role</option>
                {roles.map((item) => (
                  <option key={item} value={item} className="text-slate-100">
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm text-slate-300">Primary use cases *</h3>
              <div className="mt-3 space-y-2">
                {useCaseOptions.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-slate-200 text-sm">
                    <input
                      type="checkbox"
                      checked={useCases.includes(option)}
                      onChange={() => toggleValue(option, useCases, setUseCases)}
                      className="accent-amber-400"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm text-slate-300">Primary clouds *</h3>
              <div className="mt-3 space-y-2">
                {cloudOptions.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-slate-200 text-sm">
                    <input
                      type="checkbox"
                      checked={clouds.includes(option)}
                      onChange={() => toggleValue(option, clouds, setClouds)}
                      className="accent-amber-400"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm text-slate-300">Security requirements *</h3>
              <div className="mt-3 space-y-2">
                {securityOptions.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-slate-200 text-sm">
                    <input
                      type="checkbox"
                      checked={securityRequirements.includes(option)}
                      onChange={() => toggleValue(option, securityRequirements, setSecurityRequirements)}
                      className="accent-amber-400"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-300">Security contact email *</label>
              <input
                value={securityContactEmail}
                onChange={(event) => setSecurityContactEmail(event.target.value)}
                className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                placeholder="security@company.com"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm text-slate-300">Bring your own AI? *</h3>
            <div className="flex flex-wrap gap-3">
              {[true, false].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setAiIntegration(value)}
                  className={`px-4 py-2 rounded-xl border transition-all text-sm ${
                    aiIntegration === value
                      ? 'border-amber-400 bg-amber-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {value ? 'Yes, integrate my AI' : 'No, use Aikya AI'}
                </button>
              ))}
            </div>

            {aiIntegration && (
              <p className="text-xs text-slate-400">
                We will collect AI credentials and integration details during the go-live request.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-2 text-slate-200 text-sm">
              <input
                type="checkbox"
                checked={consentTerms}
                onChange={(event) => setConsentTerms(event.target.checked)}
                className="accent-amber-400 mt-1"
              />
              I agree to the Terms of Service and understand how Aikya operates. *
            </label>
            <label className="flex items-start gap-2 text-slate-200 text-sm">
              <input
                type="checkbox"
                checked={consentPrivacy}
                onChange={(event) => setConsentPrivacy(event.target.checked)}
                className="accent-amber-400 mt-1"
              />
              I agree to the Privacy Policy and data handling practices. *
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 text-white hover:from-amber-600 hover:to-teal-600 transition-all disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Unlock live data'}
          </button>
          <p className="text-xs text-slate-400">
            Prefer to stay on demo data for now? Toggle Demo Mode anytime in Settings.
          </p>
        </form>

        {onboarding?.completed && (
          <div className="mt-8 glass rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white">Your selections</h2>
            <p className="text-slate-300 mt-2">
              We use this to tailor your live experience.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm text-slate-300">
              <div>
                <p>Account type: <span className="text-white">{accountType}</span></p>
                <p>Organization: <span className="text-white">{organizationName || 'N/A'}</span></p>
                <p>Domain: <span className="text-white">{companyDomain || 'N/A'}</span></p>
                <p>Team size: <span className="text-white">{teamSize || 'N/A'}</span></p>
                <p>Role: <span className="text-white">{role || 'N/A'}</span></p>
              </div>
              <div>
                <p>Use cases: <span className="text-white">{useCases.join(', ') || 'N/A'}</span></p>
                <p>Clouds: <span className="text-white">{clouds.join(', ') || 'N/A'}</span></p>
                <p>Security: <span className="text-white">{securityRequirements.join(', ') || 'N/A'}</span></p>
                <p>Security contact: <span className="text-white">{securityContactEmail || 'N/A'}</span></p>
                <p>AI integration: <span className="text-white">{aiIntegration ? 'Yes' : 'No'}</span></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;

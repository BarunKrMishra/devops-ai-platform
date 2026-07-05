import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, Wand2 } from 'lucide-react';
import BusinessNav from './BusinessNav';
import { getApiErrorMessage } from '../../utils/apiError';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const templates = [
  {
    id: 'support-triage',
    name: 'Support Triage',
    description: 'Classify inbound support emails and reply with next steps.',
    type: 'support',
    triggers: [{ type: 'email_received', params: { inbox: 'support' } }],
    actions: [
      {
        type: 'ai_classify',
        params: { text: 'body', categories: ['bug', 'billing', 'feature', 'general'] }
      },
      {
        type: 'send_email',
        params: {
          to: '{{from_address}}',
          subject: 'We received your request',
          body: 'Thanks for reaching out. Our team will respond shortly.'
        }
      }
    ],
    config: { email_from: 'support@yourcompany.com' }
  },
  {
    id: 'lead-scoring',
    name: 'Lead Scoring',
    description: 'Score inbound leads and save them into the pipeline.',
    type: 'lead',
    triggers: [{ type: 'webhook', params: { path: '/leads/inbound' } }],
    actions: [
      {
        type: 'ai_score',
        params: { data: 'lead', criteria: 'budget, role, urgency, company fit' }
      },
      {
        type: 'create_lead',
        params: {
          name: '{{name}}',
          email: '{{email}}',
          company: '{{company}}',
          score: '{{ai_score}}',
          status: 'qualified'
        }
      }
    ],
    config: {}
  },
  {
    id: 'crm-sync',
    name: 'CRM Sync',
    description: 'Push qualified leads into your CRM each morning.',
    type: 'crm',
    triggers: [{ type: 'schedule', params: { cadence: 'daily', time: '09:00' } }],
    actions: [
      {
        type: 'update_crm',
        params: { system: 'hubspot', stage: 'qualified', source: 'aikya' }
      }
    ],
    config: { crm_system: 'hubspot' }
  }
];

const BusinessAutomationBuilderPage: React.FC = () => {
  const [name, setName] = useState('');
  const [type, setType] = useState('email');
  const [triggersText, setTriggersText] = useState('[]');
  const [actionsText, setActionsText] = useState('[]');
  const [configText, setConfigText] = useState('{}');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const applyTemplate = (template: typeof templates[number]) => {
    setName(template.name);
    setType(template.type);
    setTriggersText(JSON.stringify(template.triggers, null, 2));
    setActionsText(JSON.stringify(template.actions, null, 2));
    setConfigText(JSON.stringify(template.config, null, 2));
    setStatus('');
    setError('');
  };

  const saveAutomation = async () => {
    setError('');
    setStatus('');

    if (!name.trim()) {
      setError('Automation name is required.');
      return;
    }

    let triggers;
    let actions;
    let config;

    try {
      triggers = JSON.parse(triggersText || '[]');
    } catch (err) {
      setError('Triggers JSON is invalid.');
      return;
    }

    try {
      actions = JSON.parse(actionsText || '[]');
    } catch (err) {
      setError('Actions JSON is invalid.');
      return;
    }

    try {
      config = JSON.parse(configText || '{}');
    } catch (err) {
      setError('Config JSON is invalid.');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/business/automations`, {
        name,
        type,
        triggers,
        actions,
        config
      });
      setStatus('Automation created successfully.');
    } catch (err) {
      console.error('Failed to create automation:', err);
      setError(getApiErrorMessage(err, 'Failed to create automation.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-20 min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <BusinessNav />

        <div className="mb-8">
          <h1 className="text-3xl font-display text-white">Automation Builder</h1>
          <p className="text-slate-400 mt-2">
            Compose triggers and actions to automate email, CRM, and lead workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => applyTemplate(template)}
              className="glass rounded-2xl p-5 border border-white/10 text-left hover:border-amber-500/30 transition"
            >
              <div className="flex items-center gap-2 text-amber-200">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs uppercase tracking-[0.3em]">{template.type}</span>
              </div>
              <h2 className="text-lg font-semibold text-white mt-3">{template.name}</h2>
              <p className="text-sm text-slate-400 mt-2">{template.description}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
            <div>
              <label className="text-sm text-slate-300">Automation name</label>
              <input
                className="w-full mt-2 p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Automation name"
              />
            </div>

            <div>
              <label className="text-sm text-slate-300">Automation type</label>
              <select
                className="w-full mt-2 p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="email">Email automation</option>
                <option value="lead">Lead management</option>
                <option value="support">Support triage</option>
                <option value="crm">CRM sync</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300">Triggers JSON</label>
              <textarea
                className="w-full mt-2 p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100 font-mono text-sm"
                rows={6}
                value={triggersText}
                onChange={(event) => setTriggersText(event.target.value)}
              />
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
            <div>
              <label className="text-sm text-slate-300">Actions JSON</label>
              <textarea
                className="w-full mt-2 p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100 font-mono text-sm"
                rows={10}
                value={actionsText}
                onChange={(event) => setActionsText(event.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-slate-300">Config JSON</label>
              <textarea
                className="w-full mt-2 p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100 font-mono text-sm"
                rows={4}
                value={configText}
                onChange={(event) => setConfigText(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={saveAutomation}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-500/30 text-emerald-100 hover:bg-emerald-500/40 transition disabled:opacity-60"
          >
            <Wand2 className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save automation'}
          </button>
          {status && <span className="text-emerald-200 text-sm">{status}</span>}
          {error && <span className="text-red-200 text-sm">{error}</span>}
        </div>
      </div>
    </div>
  );
};

export default BusinessAutomationBuilderPage;

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PlayCircle, Sliders, Users, Mail, PlugZap } from 'lucide-react';

const navItems = [
  { path: '/business', label: 'Overview', icon: LayoutDashboard },
  { path: '/business/automations', label: 'Automations', icon: PlayCircle },
  { path: '/business/automation-builder', label: 'Builder', icon: Sliders },
  { path: '/business/leads', label: 'Leads', icon: Users },
  { path: '/business/emails', label: 'Emails', icon: Mail },
  { path: '/business/integrations', label: 'Integrations', icon: PlugZap }
];

const BusinessNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <div className="glass rounded-2xl p-3 mb-8 border border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition ${
              isActive(item.path)
                ? 'bg-amber-500/20 text-amber-200'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BusinessNav;

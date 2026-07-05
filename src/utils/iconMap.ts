import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Banknote,
  Briefcase,
  ClipboardList,
  Cloud,
  FileCheck,
  FileText,
  Flame,
  GitBranch,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  Link2,
  Lock,
  Megaphone,
  PlugZap,
  Radar,
  ServerCog,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  Workflow
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  activity: Activity,
  'banknote': Banknote,
  'briefcase': Briefcase,
  'clipboard-list': ClipboardList,
  cloud: Cloud,
  'file-check': FileCheck,
  'file-text': FileText,
  flame: Flame,
  'git-branch': GitBranch,
  'layout-dashboard': LayoutDashboard,
  'layout-template': LayoutTemplate,
  layers: Layers,
  link: Link2,
  lock: Lock,
  megaphone: Megaphone,
  'plug-zap': PlugZap,
  radar: Radar,
  'server-cog': ServerCog,
  settings: Settings,
  shield: Shield,
  'shield-check': ShieldCheck,
  'shopping-bag': ShoppingBag,
  sparkles: Sparkles,
  'trending-up': TrendingUp,
  users: Users,
  workflow: Workflow
};

export const getIcon = (key: string, fallback: LucideIcon = Sparkles) => {
  return iconMap[key] || fallback;
};

export default iconMap;

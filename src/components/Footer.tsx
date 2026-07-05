import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';
import { useContent } from '../contexts/ContentContext';
import AikyaLogo from './brand/AikyaLogo';

const Footer: React.FC = () => {
  const { content } = useContent();
  const footer = content.landing.footer;

  const socialIcons: Record<string, React.ElementType> = {
    github: Github,
    twitter: Twitter,
    linkedin: Linkedin,
    email: Mail
  };

  const renderLink = (to: string, label: string, className: string) => {
    const isExternal = to.startsWith('http') || to.startsWith('mailto:');
    if (isExternal) {
      return (
        <a href={to} className={className}>
          {label}
        </a>
      );
    }
    return (
      <Link to={to} className={className}>
        {label}
      </Link>
    );
  };

  return (
    <footer className="py-16 px-6 border-t border-white/10">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <AikyaLogo textClassName="text-white" />
            <p className="text-slate-400 leading-relaxed">{footer.about}</p>
            <div className="flex space-x-4">
              {footer.socials?.map((social) => {
                const Icon = socialIcons[social.key] || Github;
                return (
                  <a
                    key={social.key}
                    href={social.url}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {footer.columns?.map((column) => (
            <div key={column.title}>
              <h4 className="font-semibold text-white mb-4">{column.title}</h4>
              <ul className="space-y-2 text-slate-400">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {renderLink(link.to, link.label, 'hover:text-white transition-colors')}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-slate-400 text-sm">
            {footer.copyright}
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0 text-sm text-slate-400">
            {footer.legal?.map((item) => (
              <React.Fragment key={item.label}>
                {renderLink(item.to, item.label, 'hover:text-white transition-colors')}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;





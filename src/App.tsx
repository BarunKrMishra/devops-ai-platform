import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ContentProvider, useContent } from './contexts/ContentContext';
import { OpsProvider } from './contexts/OpsContext';
import LoginPage from './components/auth/LoginPage';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import Dashboard from './components/Dashboard';
import Footer from './components/Footer';
import TrustBar from './components/landing/TrustBar';
import MetricsPulse from './components/landing/MetricsPulse';
import UseCases from './components/landing/UseCases';
import OpsSuite from './components/landing/OpsSuite';
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
import BusinessDashboardPage from './components/business/BusinessDashboardPage';
import BusinessAutomationsPage from './components/business/BusinessAutomationsPage';
import BusinessAutomationBuilderPage from './components/business/BusinessAutomationBuilderPage';
import BusinessLeadsPage from './components/business/BusinessLeadsPage';
import BusinessEmailsPage from './components/business/BusinessEmailsPage';
import BusinessIntegrationsPage from './components/business/BusinessIntegrationsPage';
import OpsHubPage from './components/ops/OpsHubPage';
import OpsSuitePage from './components/ops/OpsSuitePage';

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
      <OpsSuite />
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

const AppRoutes: React.FC = () => {
  const { content } = useContent();
  const marketingPages = content.marketingPages || [];

  return (
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

          <Route path="/business" element={
            <ProtectedRoute>
              <ProtectedShell>
                <BusinessDashboardPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          <Route path="/business/automations" element={
            <ProtectedRoute>
              <ProtectedShell>
                <BusinessAutomationsPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          <Route path="/business/automation-builder" element={
            <ProtectedRoute>
              <ProtectedShell>
                <BusinessAutomationBuilderPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          <Route path="/business/leads" element={
            <ProtectedRoute>
              <ProtectedShell>
                <BusinessLeadsPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          <Route path="/business/emails" element={
            <ProtectedRoute>
              <ProtectedShell>
                <BusinessEmailsPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          <Route path="/business/integrations" element={
            <ProtectedRoute>
              <ProtectedShell>
                <BusinessIntegrationsPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          <Route path="/ops" element={
            <ProtectedRoute>
              <ProtectedShell>
                <OpsHubPage />
              </ProtectedShell>
            </ProtectedRoute>
          } />

          <Route path="/ops/:moduleKey" element={
            <ProtectedRoute>
              <ProtectedShell>
                <OpsSuitePage />
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
  );
};

function App() {
  return (
    <AuthProvider>
      <ContentProvider>
        <OpsProvider>
          <Router>
            <ScrollToHash />
            <AppRoutes />
          </Router>
        </OpsProvider>
      </ContentProvider>
    </AuthProvider>
  );
}

export default App;

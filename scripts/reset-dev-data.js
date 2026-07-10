// Reset all customer/test data so production launches clean.
//
// KEEPS: ops_modules seeds, schema_migrations, platform_admins, and the
//        platform-admin user accounts + their organizations (so you can log in).
// WIPES: everything else — users, orgs, integrations, visits, logins, audit,
//        business data, projects, requests, etc.
//
// Safety: does nothing unless you pass --yes.
//   node scripts/reset-dev-data.js --yes

import '../server/config/env.js';
import { Op } from 'sequelize';
import { sequelize } from '../server/database/sequelize.js';
import {
  User, Organization, PageView, LoginAttempt, AuditLog, AiInteraction,
  Notification, Webhook, UsageMetric, Deployment, InfrastructureResource, AlertRule,
  Incident, IntegrationEvent, IntegrationSecret, Integration, Project, Template,
  OpsPurchaseRequest, GoLiveRequest, OrganizationInvite, TeamMember, Team,
  BusinessAutomationRun, BusinessAutomation, BusinessLead, BusinessEmail,
  UserApiKey, UserSetting, OnboardingProfile, OnboardingSetting, OrganizationOps
} from '../server/models/index.js';

const CONFIRMED = process.argv.includes('--yes');

const adminEmails = String(process.env.PLATFORM_ADMIN_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

const run = async () => {
  await sequelize.authenticate();

  const adminUsers = await User.findAll({
    where: adminEmails.length ? { email: { [Op.in]: adminEmails } } : { id: -1 },
    attributes: ['id', 'email', 'organization_id'],
    raw: true
  });
  const keepUserIds = adminUsers.map((u) => u.id);
  const keepOrgIds = [...new Set(adminUsers.map((u) => u.organization_id).filter(Boolean))];

  const [userCount, orgCount, viewCount] = await Promise.all([
    User.count(), Organization.count(), PageView.count()
  ]);

  if (!CONFIRMED) {
    console.log('\n  DRY RUN — nothing was changed.\n');
    console.log(`  Would wipe:  ${userCount} users, ${orgCount} organizations, ${viewCount} page views, and all related data.`);
    console.log(`  Would KEEP:  ops module seeds, schema history, platform admins, and ${adminUsers.length} admin account(s):`);
    adminUsers.forEach((u) => console.log(`                 - ${u.email}`));
    console.log('\n  Re-run with --yes to actually reset.\n');
    await sequelize.close();
    return;
  }

  // Wipe all customer/activity data tables entirely.
  const wipeAll = [
    PageView, LoginAttempt, AuditLog, AiInteraction, Notification, Webhook, UsageMetric,
    Deployment, InfrastructureResource, AlertRule, Incident, IntegrationEvent,
    IntegrationSecret, Integration, Project, Template, OpsPurchaseRequest, GoLiveRequest,
    OrganizationInvite, TeamMember, Team, BusinessAutomationRun, BusinessAutomation,
    BusinessLead, BusinessEmail, UserApiKey, UserSetting, OnboardingProfile,
    OnboardingSetting, OrganizationOps
  ];
  for (const Model of wipeAll) {
    await Model.destroy({ where: {} });
  }

  // Remove all non-admin users and organizations.
  await User.destroy({ where: keepUserIds.length ? { id: { [Op.notIn]: keepUserIds } } : {} });
  await Organization.destroy({ where: keepOrgIds.length ? { id: { [Op.notIn]: keepOrgIds } } : {} });

  const [usersLeft, orgsLeft] = await Promise.all([User.count(), Organization.count()]);
  console.log('\n  ✓ Reset complete.');
  console.log(`  Users remaining:         ${usersLeft} (platform admins)`);
  console.log(`  Organizations remaining: ${orgsLeft}`);
  console.log('  Ops modules + migrations preserved. You can log in and start clean.\n');

  await sequelize.close();
};

run().catch((error) => {
  console.error('Reset failed:', error);
  process.exit(1);
});

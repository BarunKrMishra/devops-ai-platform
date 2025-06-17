import express from 'express';
import { Octokit } from '@octokit/rest';
import { db } from '../database/init.js';
import { logAuditAction } from '../utils/audit.js';

const router = express.Router();

// Get user's repositories (GitHub)
router.get('/repositories', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if user has GitHub token
    const user = db.prepare('SELECT github_token FROM users WHERE id = ?').get(userId);
    
    if (!user?.github_token) {
      return res.status(401).json({ 
        error: 'GitHub integration not configured. Please connect your GitHub account first.' 
      });
    }

    const octokit = new Octokit({
      auth: user.github_token
    });

    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 50
    });

    // Transform repository data
    const repositories = data.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      default_branch: repo.default_branch,
      language: repo.language,
      description: repo.description,
      private: repo.private,
      updated_at: repo.updated_at
    }));

    res.json(repositories);
  } catch (error) {
    console.error('Repository fetch error:', error);
    
    if (error.status === 401) {
      return res.status(401).json({ 
        error: 'GitHub token expired or invalid. Please reconnect your GitHub account.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch repositories. Please try again later.' 
    });
  }
});

// Get project pipelines (for current user)
router.get('/pipelines', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get projects with their pipelines
    const projects = db.prepare(
      `SELECT p.*, 
              COUNT(d.id) as deployment_count,
              MAX(d.created_at) as last_deployment
       FROM projects p
       LEFT JOIN deployments d ON p.id = d.project_id
       WHERE p.user_id = ?
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    ).all(userId);

    // Get recent deployments for each project
    const projectsWithDeployments = projects.map(project => {
      const deployments = db.prepare(
        `SELECT d.*, 
                p.name as project_name,
                p.repository_url
         FROM deployments d
         JOIN projects p ON d.project_id = p.id
         WHERE d.project_id = ?
         ORDER BY d.created_at DESC
         LIMIT 5`
      ).all(project.id);
      
      return {
        ...project,
        deployments
      };
    });

    res.json(projectsWithDeployments);
  } catch (error) {
    console.error('Pipelines fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch pipelines. Please try again later.' 
    });
  }
});

// Create CI/CD pipeline (project)
router.post('/pipeline', async (req, res) => {
  try {
    const { repositoryUrl, branch, framework, cloudProvider } = req.body;
    const userId = req.user.id;

    if (!repositoryUrl || !branch || !framework || !cloudProvider) {
      return res.status(400).json({ 
        error: 'Missing required fields: repositoryUrl, branch, framework, cloudProvider' 
      });
    }

    // Validate framework
    const validFrameworks = ['react', 'vue', 'angular', 'node', 'python'];
    if (!validFrameworks.includes(framework)) {
      return res.status(400).json({ 
        error: `Invalid framework. Must be one of: ${validFrameworks.join(', ')}` 
      });
    }

    // Validate cloud provider
    const validProviders = ['aws', 'gcp', 'azure'];
    if (!validProviders.includes(cloudProvider)) {
      return res.status(400).json({ 
        error: `Invalid cloud provider. Must be one of: ${validProviders.join(', ')}` 
      });
    }

    // Create project
    const stmt = db.prepare(
      `INSERT INTO projects (
        user_id, 
        name, 
        repository_url, 
        branch, 
        framework, 
        cloud_provider,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    
    const info = stmt.run(
      userId,
      repositoryUrl.split('/').pop(),
      repositoryUrl,
      branch,
      framework,
      cloudProvider,
      'active'
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid);

    // Generate CI/CD configuration based on framework
    const pipelineConfig = generatePipelineConfig(framework, cloudProvider);

    // Log audit action
    await logAuditAction(userId, 'CREATE_PIPELINE', 'project', project.id, {
      repository: repositoryUrl,
      framework,
      cloudProvider
    });

    res.json({
      project,
      pipelineConfig
    });
  } catch (error) {
    console.error('Pipeline creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create pipeline. Please try again later.' 
    });
  }
});

// Trigger deployment
router.post('/deploy/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { environment = 'production' } = req.body;
    const userId = req.user.id;

    // Get project with user verification
    const project = db.prepare(
      `SELECT p.*, u.id as user_id 
       FROM projects p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ? AND p.user_id = ?`
    ).get(projectId, userId);

    if (!project) {
      return res.status(404).json({ 
        error: 'Project not found or you do not have permission to deploy it.' 
      });
    }

    // Check if there's already a running deployment
    const runningDeployment = db.prepare(
      `SELECT d.*, p.name as project_name
       FROM deployments d
       JOIN projects p ON d.project_id = p.id
       WHERE d.project_id = ? AND d.status = ?
       ORDER BY d.created_at DESC
       LIMIT 1`
    ).get(projectId, 'running');

    if (runningDeployment) {
      return res.status(409).json({ 
        error: 'A deployment is already in progress. Please wait for it to complete.' 
      });
    }

    // Create deployment record
    const insertStmt = db.prepare(
      `INSERT INTO deployments (
        project_id, 
        status, 
        environment, 
        commit_hash,
        started_at
      ) VALUES (?, ?, ?, ?, ?)`
    );
    
    const info = insertStmt.run(
      projectId, 
      'running', 
      environment, 
      'latest',
      new Date().toISOString()
    );

    const deployment = db.prepare(
      `SELECT d.*, p.name as project_name
       FROM deployments d
       JOIN projects p ON d.project_id = p.id
       WHERE d.id = ?`
    ).get(info.lastInsertRowid);

    // Simulate deployment process
    setTimeout(() => {
      const success = Math.random() > 0.2; // 80% success rate
      const duration = Math.floor(Math.random() * 300) + 60; // 1-5 minutes

      db.prepare(
        `UPDATE deployments 
         SET status = ?, 
             duration = ?,
             completed_at = ?
         WHERE id = ?`
      ).run(
        success ? 'success' : 'failed',
        duration,
        new Date().toISOString(),
        deployment.id
      );
    }, 2000);

    // Log audit action
    await logAuditAction(userId, 'TRIGGER_DEPLOYMENT', 'deployment', deployment.id, {
      projectId,
      environment
    });

    res.json(deployment);
  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ 
      error: 'Failed to trigger deployment. Please try again later.' 
    });
  }
});

// Helper function to generate pipeline configuration
function generatePipelineConfig(framework, cloudProvider) {
  const baseConfig = {
    version: '1.0',
    environment: {
      provider: cloudProvider,
      region: 'us-east-1'
    },
    build: {
      commands: []
    },
    deploy: {
      commands: []
    }
  };

  switch (framework) {
    case 'react':
      baseConfig.build.commands = [
        'npm install',
        'npm run build'
      ];
      baseConfig.deploy.commands = [
        'npm run deploy'
      ];
      break;
    case 'vue':
      baseConfig.build.commands = [
        'npm install',
        'npm run build'
      ];
      baseConfig.deploy.commands = [
        'npm run deploy'
      ];
      break;
    case 'angular':
      baseConfig.build.commands = [
        'npm install',
        'ng build --prod'
      ];
      baseConfig.deploy.commands = [
        'ng deploy'
      ];
      break;
    case 'node':
      baseConfig.build.commands = [
        'npm install',
        'npm run build'
      ];
      baseConfig.deploy.commands = [
        'npm run deploy'
      ];
      break;
    case 'python':
      baseConfig.build.commands = [
        'pip install -r requirements.txt',
        'python setup.py build'
      ];
      baseConfig.deploy.commands = [
        'python deploy.py'
      ];
      break;
  }

  return baseConfig;
}

export default router;
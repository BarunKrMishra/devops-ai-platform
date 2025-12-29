# DevOps AI Platform

A modern DevOps platform with AI-powered automation, CI/CD pipelines, infrastructure management, and team collaboration features.

## Features

- 🔐 Secure Authentication & Authorization
- 🔄 CI/CD Pipeline Management
- ☁️ Multi-Cloud Infrastructure Management
- 📊 Real-time Monitoring & Analytics
- 🤖 AI-Powered Automation
- 👥 Team Collaboration
- 📝 Audit Logging
- 🎯 Predictive Analytics

## Tech Stack

- Frontend: React, TypeScript, TailwindCSS
- Backend: Node.js, Express
- Database: SQLite
- Authentication: JWT, GitHub OAuth
- AI/ML: OpenAI, Anthropic, Google AI
- Cloud: AWS, GCP, Azure

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Git
- GitHub account (for OAuth)

## Setup

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd devops-ai-platform
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   # Frontend Environment Variables
   VITE_API_URL=http://localhost:3001
   VITE_GITHUB_CLIENT_ID=your_github_client_id

   # Backend Environment Variables
   JWT_SECRET=your_jwt_secret
   NODE_ENV=development

   # GitHub OAuth
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret

   # Database
   DB_PATH=./devops_ai.db
   ```

4. Set up GitHub OAuth:
   - Go to GitHub Settings > Developer Settings > OAuth Apps
   - Create a new OAuth App
   - Set Homepage URL to `http://localhost:5173`
   - Set Callback URL to `http://localhost:3001/api/auth/github/callback`
   - Copy Client ID and Client Secret to your `.env` file

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:5173](http://localhost:5173) in your browser

## Docker Deployment

1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```

2. Fill in the required variables in `.env`:
   - `JWT_SECRET`
   - `INTEGRATION_MASTER_KEY`
   - `VITE_GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`

3. Build and run:
   ```bash
   docker-compose up -d --build
   ```

4. Open the app at [http://your-server-ip:2025](http://your-server-ip:2025).

Notes:
- The API runs on port 3001 inside the Docker network.
- SQLite data is stored in a Docker volume named `aikya_data`.
- Set `APP_BASE_URL`, `CORS_ORIGIN`, and `VITE_API_URL` to include port 2025.

## Development

- Frontend runs on port 5173
- Backend runs on port 3001
- Database is stored in `devops_ai.db`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

License - see LICENSE file for details

## Support

For support, email support@devops-ai.com or join our Slack community.

## Roadmap

- [ ] Kubernetes integration
- [ ] Multi-region deployments
- [ ] Advanced AI models
- [ ] Mobile application
- [ ] Enterprise SSO
- [ ] Advanced analytics dashboard
- [ ] Terraform integration
- [ ] Slack/Teams notifications
- [ ] Custom deployment strategies
- [ ] Advanced security scanning

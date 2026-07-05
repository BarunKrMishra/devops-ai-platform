import express from 'express';

export const createOpsService = ({ key, name, description, defaultPort, integrations }) => {
  const app = express();
  const port = Number(process.env.PORT || defaultPort);

  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: key });
  });

  app.get('/info', (req, res) => {
    res.json({
      key,
      name,
      description,
      ai_enabled: true,
      integrations,
      timestamp: new Date().toISOString()
    });
  });

  app.listen(port, () => {
    console.log(`${name} service listening on port ${port}`);
  });
};

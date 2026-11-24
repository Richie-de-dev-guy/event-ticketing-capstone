import { pathToFileURL } from 'node:url';
import { createSqliteRepository } from './repositories/sqlite.js';
import { createApiRouter } from './http/apiRoutes.js';
import { createAppServer } from './http/app.js';
import { PORT } from './config.js';

export function startServer(port = PORT) {
  const repository = createSqliteRepository();
  const server = createAppServer({ router: createApiRouter({ repository }) });
  server.once('close', () => repository.close());
  server.listen(port, () => {
    console.log(`Event ticketing server listening on port ${port}`);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}

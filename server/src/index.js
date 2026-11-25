import { PORT } from './config.js';
import { createServer } from './app.js';

const { server } = createServer();
server.listen(PORT, () => {
  console.log(`Roomie API listening on http://localhost:${PORT}`);
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { Store } from './store';

const port = Number(process.env.PORT ?? 4000);

const persistPath = process.env.DB_PATH ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/db.json');

createApp(new Store({ persistPath, history: true })).listen(port, () => {
  console.log(`GCash Loyalty API listening on http://localhost:${port}`);
});

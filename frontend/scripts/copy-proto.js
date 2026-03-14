import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.resolve(__dirname, '../../proto/game/player.proto');
const dest = path.resolve(__dirname, '../public/proto/game/player.proto');

try {
  let content = fs.readFileSync(src, 'utf8');
  content = `// @generated\n// This file is generated. Do not edit.\n\n${content}`;

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  console.log('Proto file copied and marked as @generated');
} catch (error) {
  console.error('Failed to copy proto file:', error);
  process.exit(1);
}

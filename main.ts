// SOLANO HEAT — make.fun gta6-01 entry program (round 9).
// Copies game/ and screenshots/ into the output directory and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Standard library only; runs on Node 22 with no install and no network.
import { cpSync, mkdirSync, writeFileSync, readdirSync, statSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

mkdirSync(join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// The grader collects /output as another user: leave every output readable.
function chmodTree(dir, fileMode, dirMode) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      chmodSync(p, dirMode);
      chmodTree(p, fileMode, dirMode);
    } else {
      chmodSync(p, fileMode);
    }
  }
}
chmodSync(outDir, 0o755);
chmodTree(outDir, 0o644, 0o755);
console.log(`SOLANO HEAT: wrote ${outDir} (dossier ${dossier.length} bytes)`);

import * as fsExtra from 'fs-extra';
import * as path from 'path';

function buildEngineDistCandidates(cwd: string): string[] {
  const overridePath = process.env.WEBGAL_ENGINE_DIST?.trim();
  const candidates = [
    overridePath ? path.resolve(cwd, overridePath) : '',
    path.join(cwd, 'node_modules', 'webgal-engine', 'dist'),
    path.join(cwd, '..', '..', 'node_modules', 'webgal-engine', 'dist'),
    path.join(cwd, '..', '..', '..', 'WebGAL', 'packages', 'webgal', 'dist'),
  ];

  return Array.from(new Set(candidates.filter(Boolean)));
}

export async function resolveWebgalEngineDist(cwd: string): Promise<string> {
  for (const candidate of buildEngineDistCandidates(cwd)) {
    if (await fsExtra.pathExists(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  throw new Error(
    `未找到可用的 webgal-engine dist。已检查路径：${buildEngineDistCandidates(cwd).join('；')}`,
  );
}

export async function syncWebgalTemplate(templateDir: string, sourceDistDir: string): Promise<void> {
  const sourceEntries = await fsExtra.readdir(sourceDistDir);
  const shouldResetGame = sourceEntries.includes('game');
  const shouldResetLib = sourceEntries.includes('lib');
  const filesToDelete = [
    path.join(templateDir, 'assets'),
    path.join(templateDir, 'index.html'),
    path.join(templateDir, 'webgal-serviceworker.js'),
  ];

  // 仅在引擎包仍提供 game/lib 时重置，避免 4.5.18+ 把模板默认游戏素材删空
  if (shouldResetGame) filesToDelete.push(path.join(templateDir, 'game'));
  if (shouldResetLib) filesToDelete.push(path.join(templateDir, 'lib'));

  await Promise.all(filesToDelete.map((file) => fsExtra.remove(file)));
  await fsExtra.ensureDir(templateDir);

  await Promise.all(
    sourceEntries.map((entryName) =>
      fsExtra.copy(
        path.join(sourceDistDir, entryName),
        path.join(templateDir, entryName),
      ),
    ),
  );
}

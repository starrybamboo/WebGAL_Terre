import * as path from 'path';
import * as fsExtra from 'fs-extra';

async function updateWebGALEngineFiles() {
  // 获取当前工作目录
  const cwd = process.cwd();
  // 目标模板目录
  const templateDir = path.join(cwd, 'assets', 'templates', 'WebGAL_Template');
  const sourceDistDir = path.join(
    cwd,
    'node_modules',
    'webgal-engine',
    'dist',
  );

  console.log('正在从 node_modules 复制新的 WebGAL 引擎文件...');
  try {
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

    console.log('正在删除旧的 WebGAL 引擎文件...');
    await Promise.all(filesToDelete.map((file) => fsExtra.remove(file)));
    console.log('旧文件删除成功。');

    // 确保目标目录存在
    await fsExtra.ensureDir(templateDir);

    // 兼容 4.5.18+ 的 dist 目录结构变更：按 dist 实际内容动态复制
    await Promise.all(
      sourceEntries.map((entryName) =>
        fsExtra.copy(
          path.join(sourceDistDir, entryName),
          path.join(templateDir, entryName),
        ),
      ),
    );

    console.log('新 WebGAL 引擎文件复制成功。');
  } catch (error) {
    console.error('复制新文件时出错:', error);
    throw error;
  }
}

// 执行更新并处理错误
updateWebGALEngineFiles().catch((error) => {
  console.error('更新 WebGAL 引擎文件时发生错误:', error);
  process.exit(1); // 出错时退出进程
});

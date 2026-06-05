import * as path from 'path';
import * as fsExtra from 'fs-extra';
import { resolveWebgalEngineDist, syncWebgalTemplate } from './src/util/webgalEngine';

async function updateWebGALEngineFiles() {
  // 获取当前工作目录
  const cwd = process.cwd();
  // 目标模板目录
  const templateDir = path.join(cwd, 'assets', 'templates', 'WebGAL_Template');
  const sourceDistDir = await resolveWebgalEngineDist(cwd);

  console.log(`正在从 ${sourceDistDir} 复制新的 WebGAL 引擎文件...`);
  try {
    console.log('正在删除旧的 WebGAL 引擎文件...');
    await syncWebgalTemplate(templateDir, sourceDistDir);
    console.log('旧文件删除成功。');

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

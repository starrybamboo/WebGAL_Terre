import * as path from 'path';
import * as fsExtra from 'fs-extra';
import { resolveWebgalEngineDist } from './webgalEngine';

jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
}));

const mockedPathExists = fsExtra.pathExists as jest.MockedFunction<typeof fsExtra.pathExists>;

describe('resolveWebgalEngineDist', () => {
  const cwd = path.resolve('D:/A_collection/WebGAL_Terre/packages/terre2');
  const localDist = path.resolve(cwd, '..', '..', '..', 'WebGAL', 'packages', 'webgal', 'dist');

  const originalEnv = process.env.WEBGAL_ENGINE_DIST;

  afterEach(() => {
    process.env.WEBGAL_ENGINE_DIST = originalEnv;
    mockedPathExists.mockReset();
  });

  it('uses the local WebGAL build instead of node_modules webgal-engine', async () => {
    process.env.WEBGAL_ENGINE_DIST = '';
    mockedPathExists.mockImplementation(async (targetPath) => {
      const normalized = path.resolve(targetPath.toString());
      return normalized === path.join(localDist, 'index.html');
    });

    await expect(resolveWebgalEngineDist(cwd)).resolves.toBe(localDist);

    const checkedPaths = mockedPathExists.mock.calls.map(([targetPath]) => targetPath.toString());
    expect(checkedPaths).toEqual([path.join(localDist, 'index.html')]);
    expect(checkedPaths.some((targetPath) => targetPath.includes('node_modules'))).toBe(false);
  });

  it('allows an explicit WEBGAL_ENGINE_DIST override', async () => {
    process.env.WEBGAL_ENGINE_DIST = '../custom-webgal-dist';
    const overrideDist = path.resolve(cwd, '../custom-webgal-dist');
    mockedPathExists.mockResolvedValue(true);

    await expect(resolveWebgalEngineDist(cwd)).resolves.toBe(overrideDist);
    expect(mockedPathExists).toHaveBeenCalledWith(path.join(overrideDist, 'index.html'));
  });
});

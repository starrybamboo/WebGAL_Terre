import { ManageGameService } from './manage-game.service';
import { WebgalFsService } from '../webgal-fs/webgal-fs.service';

describe('ManageGameService', () => {
  let service: ManageGameService;
  let webgalFs: {
    getDirInfo: jest.Mock;
    getPathFromRoot: jest.Mock;
    mkdir: jest.Mock;
    copy: jest.Mock;
    existsDir: jest.Mock;
    replaceTextFile: jest.Mock;
    deleteFileOrDirectory: jest.Mock;
    updateTextFile: jest.Mock;
  };

  beforeEach(() => {
    webgalFs = {
      getDirInfo: jest.fn().mockResolvedValue([]),
      getPathFromRoot: jest.fn((path: string) => path),
      mkdir: jest.fn().mockResolvedValue(undefined),
      copy: jest.fn().mockResolvedValue(true),
      existsDir: jest.fn().mockResolvedValue(false),
      replaceTextFile: jest.fn().mockResolvedValue('Replaced.'),
      deleteFileOrDirectory: jest.fn().mockResolvedValue(true),
      updateTextFile: jest.fn().mockResolvedValue('Updated.'),
    };

    service = new ManageGameService({} as any, webgalFs as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates clean default games without demo assets', async () => {
    const result = await service.createGame({
      gameName: '空白项目',
      gameDir: 'blank-game',
    });

    expect(result).toBe(true);
    expect(webgalFs.copy).toHaveBeenCalledWith(
      '/assets/templates/WebGAL_Template/game/',
      '/public/games/blank-game/game/',
    );
    expect(webgalFs.deleteFileOrDirectory).toHaveBeenCalledWith(
      '/public/games/blank-game/game/background',
    );
    expect(webgalFs.deleteFileOrDirectory).toHaveBeenCalledWith(
      '/public/games/blank-game/game/figure',
    );
    expect(webgalFs.deleteFileOrDirectory).toHaveBeenCalledWith(
      '/public/games/blank-game/game/scene',
    );
    expect(webgalFs.mkdir).toHaveBeenCalledWith(
      '/public/games/blank-game/game',
      'background',
    );
    expect(webgalFs.mkdir).toHaveBeenCalledWith(
      '/public/games/blank-game/game',
      'figure',
    );
    expect(webgalFs.mkdir).toHaveBeenCalledWith(
      '/public/games/blank-game/game',
      'scene',
    );
    expect(webgalFs.updateTextFile).toHaveBeenCalledWith(
      '/public/games/blank-game/game/config.txt',
      'Game_name:空白项目;\nGame_key:blank-game;\n',
    );
    expect(webgalFs.updateTextFile).toHaveBeenCalledWith(
      '/public/games/blank-game/game/scene/start.txt',
      '',
    );
    expect(webgalFs.replaceTextFile).toHaveBeenCalledWith(
      '/public/games/blank-game/game/config.txt',
      /Game_name:.*?;/,
      'Game_name:空白项目;',
    );
    expect(webgalFs.deleteFileOrDirectory).toHaveBeenCalledWith(
      '/public/games/blank-game/game/template',
    );
    expect(webgalFs.copy).toHaveBeenCalledWith(
      '/assets/templates/WebGAL_Default_Template/',
      '/public/games/blank-game/game/template/',
    );
  });

  it('keeps derivative game creation behavior', async () => {
    const result = await service.createGame({
      gameName: '派生项目',
      gameDir: 'derivative-game',
      derivative: 'custom-engine',
    });

    expect(result).toBe(true);
    expect(webgalFs.copy).toHaveBeenCalledWith(
      '/assets/templates/Derivative_Engine/custom-engine/',
      '/public/games/derivative-game/',
    );
    expect(webgalFs.replaceTextFile).toHaveBeenCalledWith(
      '/public/games/derivative-game/game/config.txt',
      /Game_name:.*?;/,
      'Game_name:派生项目;',
    );
    expect(webgalFs.deleteFileOrDirectory).toHaveBeenCalledWith(
      '/public/games/derivative-game/game/template',
    );
    expect(webgalFs.copy).toHaveBeenCalledWith(
      '/assets/templates/WebGAL_Default_Template/',
      '/public/games/derivative-game/game/template/',
    );
    expect(webgalFs.updateTextFile).not.toHaveBeenCalled();
  });
});

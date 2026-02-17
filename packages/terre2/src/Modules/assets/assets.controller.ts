import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  IUploadFileInfo,
  WebgalFsService,
} from '../webgal-fs/webgal-fs.service';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import {
  CreateNewFileDto,
  DeleteFileOrDirDto,
  CreateNewFolderDto,
  RenameFileDto,
  UploadFilesDto,
  EditTextFileDto,
  UploadByUrlDto,
} from './assets.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { _open } from '../../util/open';

@Controller('api/assets')
@ApiTags('Assets')
export class AssetsController {
  constructor(
    private readonly webgalFs: WebgalFsService,
    private readonly assets: AssetsService,
  ) {}

  @Get('readAssets/:readDirPath(*)')
  @ApiOperation({ summary: 'Read Assets' })
  @ApiResponse({
    status: 200,
    description: 'Retrieve the assets of the directory.',
  })
  @ApiParam({
    name: 'readDirPath',
    type: String,
    description:
      'Path of the directory to read assets from, including subdirectories.',
  })
  async readAssets(@Param('readDirPath') readDirPath: string) {
    const normalizedReadDirPath = decodeURIComponent(readDirPath);
    const readDirPathWithPublic = `public/${normalizedReadDirPath}`;
    const dirPath = this.webgalFs.getPathFromRoot(readDirPathWithPublic);
    const dirExists = await this.webgalFs.exists(dirPath);
    const dirInfo = dirExists ? await this.webgalFs.getDirInfo(dirPath) : [];
    return { readDirPath: readDirPathWithPublic, dirPath, dirInfo };
  }

  @Post('openDict/:dirPath(*)')
  @ApiOperation({ summary: 'Open Assets Dictionary' })
  @ApiResponse({
    status: 200,
    description: 'Opens the assets dictionary for a specified game.',
  })
  @ApiParam({
    name: 'dirPath',
    type: String,
    description: 'Directory path to open.',
  })
  async openDict(@Param('dirPath') dirPath: string) {
    dirPath = `public/${decodeURIComponent(dirPath)}`;
    const path = this.webgalFs.getPathFromRoot(dirPath);
    await _open(path);
  }

  @Post('createNewFile')
  @ApiOperation({ summary: 'Create a New FIle' })
  @ApiResponse({ status: 200, description: 'Successfully created the File.' })
  @ApiResponse({
    status: 400,
    description: 'Failed to create the File or file already exists.',
  })
  async createNewFile(
    @Body() createNewFileData: CreateNewFileDto,
  ): Promise<string | void> {
    const path = this.webgalFs.getPathFromRoot(
      `public/${createNewFileData.source}/${createNewFileData.name}`,
    );

    if (await this.webgalFs.exists(path)) {
      throw new BadRequestException('Scene already exists');
    }

    return this.webgalFs.createEmptyFile(path);
  }

  @Post('createNewFolder')
  @ApiOperation({ summary: 'Create Folder' })
  @ApiResponse({ status: 200, description: 'Folder created successfully.' })
  @ApiResponse({ status: 400, description: 'Failed to create Folder.' })
  async createNewFolder(@Body() createNewFolderData: CreateNewFolderDto) {
    await this.webgalFs.mkdir(
      this.webgalFs.getPathFromRoot(`public/${createNewFolderData.source}`),
      createNewFolderData.name,
    );
    return true;
  }

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiOperation({ summary: 'Upload Files' })
  @ApiResponse({ status: 200, description: 'Files uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'Failed to upload files.' })
  async upload(@UploadedFiles() files, @Body() uploadFilesDto: UploadFilesDto) {
    const fileInfos: IUploadFileInfo[] = files.map((file) => {
      return { fileName: file.originalname, file: file.buffer };
    });
    return this.webgalFs.writeFiles(
      `public/${uploadFilesDto.targetDirectory}`,
      fileInfos,
    );
  }

  @Post('uploadByUrl')
  @ApiOperation({ summary: 'Upload file by source url' })
  @ApiResponse({
    status: 200,
    description: 'Source file downloaded and uploaded successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to download source file.',
  })
  async uploadByUrl(@Body() uploadByUrlDto: UploadByUrlDto) {
    const sourceUrl = this.parseSourceUrl(uploadByUrlDto.sourceUrl);
    const resolvedFileName = this.resolveUploadFileName(
      uploadByUrlDto.fileName,
      sourceUrl,
    );

    const response = await fetch(sourceUrl.toString());
    if (!response.ok) {
      throw new BadRequestException(
        `Failed to download source file, status: ${response.status}`,
      );
    }

    const fileBuffer = Buffer.from(await response.arrayBuffer());
    if (fileBuffer.length === 0) {
      throw new BadRequestException('Downloaded file is empty');
    }

    const uploadResult = await this.webgalFs.writeFiles(
      `public/${uploadByUrlDto.targetDirectory}`,
      [{ fileName: resolvedFileName, file: fileBuffer }],
    );

    if (!uploadResult) {
      throw new BadRequestException('Failed to save downloaded file');
    }

    return { fileName: resolvedFileName };
  }

  @Post('delete')
  @ApiOperation({ summary: 'Delete File or Directory' })
  @ApiResponse({
    status: 200,
    description: 'Successfully deleted the file or directory.',
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to delete the file or directory.',
  })
  async deleteFileOrDir(@Body() fileOperationDto: DeleteFileOrDirDto) {
    return this.webgalFs.deleteFileOrDirectory(
      this.webgalFs.getPathFromRoot(`public/${fileOperationDto.source}`),
    );
  }

  @Post('rename')
  @ApiOperation({ summary: 'Rename File or Directory' })
  @ApiResponse({
    status: 200,
    description: 'Successfully renamed the file or directory.',
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to rename the file or directory.',
  })
  async rename(@Body() fileOperationDto: RenameFileDto) {
    return this.webgalFs.renameFile(
      this.webgalFs.getPathFromRoot(`public/${fileOperationDto.source}`),
      fileOperationDto.newName,
    );
  }

  @Post('editTextFile')
  @ApiOperation({ summary: 'Edit Text File' })
  @ApiResponse({ status: 200, description: 'File edited successfully.' })
  @ApiResponse({ status: 400, description: 'Failed to edit the text.' })
  async editTextFile(@Body() editTextFileData: EditTextFileDto) {
    const path = editTextFileData.path;
    const filePath = this.webgalFs.getPathFromRoot(`public/${path}`);
    return this.webgalFs.updateTextFile(filePath, editTextFileData.textFile);
  }

  private parseSourceUrl(rawSourceUrl: string): URL {
    let sourceUrl: URL;
    try {
      sourceUrl = new URL(rawSourceUrl);
    } catch {
      throw new BadRequestException('Invalid sourceUrl');
    }

    if (sourceUrl.protocol !== 'http:' && sourceUrl.protocol !== 'https:') {
      throw new BadRequestException(
        'sourceUrl protocol must be http or https',
      );
    }

    return sourceUrl;
  }

  private resolveUploadFileName(rawFileName: string | undefined, sourceUrl: URL) {
    const inferredNameRaw = sourceUrl.pathname.split('/').pop() ?? '';
    let inferredName = inferredNameRaw;
    try {
      inferredName = decodeURIComponent(inferredNameRaw);
    } catch {
      inferredName = inferredNameRaw;
    }

    const candidateName = (rawFileName ?? inferredName).trim();
    const normalizedName = candidateName
      .replace(/[\/\\]/g, '')
      .replace(/[\u0000-\u001f\u007f]/g, '');

    if (
      !normalizedName ||
      normalizedName === '.' ||
      normalizedName === '..'
    ) {
      throw new BadRequestException('Invalid target file name');
    }

    return normalizedName;
  }
}

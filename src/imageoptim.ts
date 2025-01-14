import chalk from 'chalk';
import program = require('commander');
import { sync } from 'globby';
import { homedir } from 'os';
import { parseImage } from 'image-marker';
import { fromFile } from 'file-type';
import { cli } from './';
import {
  PNGQUANT_NUMBER_OF_COLORS,
  PNGQUANT_QUALITY,
  PNGQUANT_SPEED,
  SUPPORTED_FILE_TYPES,
  TMPDIR,
  VERSION
} from './constants';

const patterns: string[] = [];
const IMAGE_TAG = Buffer.from('min:cli');
const UNSUPPORTED_MIME = ['apng'];

program
  .version(VERSION)
  .arguments('[patterns...]')
  .action((args: string[]) => {
    patterns.push(...args.filter((arg) => arg && typeof arg === 'string'));
  })
  .option('-a, --imagealpha', 'enable ImageAlpha')
  .option('-j, --jpegmini', 'enable JPEGmini')
  .option('-C, --no-color', 'output to the terminal without colors')
  .option('-I, --no-imageoptim', 'disable ImageOptim')
  .option('-Q, --no-quit', 'do not quit apps once finished')
  .option('-S, --no-stats', 'do not display file size savings and quality loss information')
  .option(
    '--number-of-colors <n>',
    `ImageAlpha palette size, defaults to ${PNGQUANT_NUMBER_OF_COLORS}`
  )
  .option(
    '--quality <min>-<max>',
    `ImageAlpha quality range from 0-100, defaults to ${PNGQUANT_QUALITY}`
  )
  .option(
    '--speed <n>',
    `ImageAlpha speed from 1 (brute-force) to 10 (fastest), defaults to ${PNGQUANT_SPEED}`
  );

program.on('--help', () => {
  console.log(
    `
  Supported Apps:

    ImageAlpha: ${chalk.blue.underline('https://pngmini.com')}
    ImageOptim: ${chalk.blue.underline('https://imageoptim.com')}
    JPEGmini Lite: ${chalk.blue.underline(
      'https://itunes.apple.com/us/app/jpegmini-lite/id525742250'
    )}
    JPEGmini Pro: ${chalk.blue.underline(
      'https://itunes.apple.com/us/app/jpegmini-pro/id887163276'
    )}
    JPEGmini: ${chalk.blue.underline('https://itunes.apple.com/us/app/jpegmini/id498944723')}

  Examples:

    ${chalk.dim('Run ImageOptim.app over every image in current directory')}
    imageoptim

    ${chalk.dim('Run ImageAlpha.app and ImageOptim.app over every PNG in current directory')}
    imageoptim --imagealpha '**/*.png'

    ${chalk.dim('Run JPEGmini.app and ImageOptim.app over every JPG in current directory')}
    imageoptim --jpegmini '**/*.jpg' '**/*.jpeg'

    ${chalk.dim('Run JPEGmini.app over every JPG in current directory')}
    imageoptim --jpegmini --no-imageoptim '**/*.jpg' '**/*.jpeg'

    ${chalk.dim('Run ImageOptim.app over every image in a specific directory')}
    imageoptim '~/Desktop'
    `.trimRight()
  );
});

program.parse(process.argv);

if (process.platform !== 'darwin') {
  console.log('imageoptim-cli is macOS only');
}

const supportedTypesPattern = SUPPORTED_FILE_TYPES.map((fileType) => `*${fileType}`).join('|');

patterns.push(`!**/!(${supportedTypesPattern})`);

const filePaths = sync(patterns.map((pattern) => pattern.replace('~', homedir())));

const filterImgs = async (files: string[]) => {
  let list = [];
  for (let index = 0; index < files.length; index++) {
    const filePath = files[index];
    const typeInfo = await fromFile(filePath);
    const checker = await parseImage(filePath, IMAGE_TAG);
    const haveTag = await checker.haveTag();

    if (!haveTag && !UNSUPPORTED_MIME.includes((typeInfo && typeInfo.ext) || '')) {
      list.push(filePath);
    }
  }
  return list;
};

const addTags = async (files: string[]) => {
  for (let index = 0; index < files.length; index++) {
    const filePath = files[index];
    const checker = await parseImage(filePath, IMAGE_TAG);
    await checker.addTagAndSaveFile();
  }
};

const start = async () => {
  const files = await filterImgs(filePaths);
  await cli({
    batchSize: 300,
    enabled: {
      color: program.color === true,
      imageAlpha: program.imagealpha === true,
      imageOptim: program.imageoptim === true,
      jpegMini: program.jpegmini === true,
      quit: program.quit === true,
      stats: program.stats === true
    },
    filePaths: files,
    numberOfColors: program.numberOfColors || PNGQUANT_NUMBER_OF_COLORS,
    quality: program.quality || PNGQUANT_QUALITY,
    speed: program.speed || PNGQUANT_SPEED,
    tmpDir: TMPDIR
  });
  await addTags(filePaths);
};
start();

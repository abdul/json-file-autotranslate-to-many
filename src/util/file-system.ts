import * as fs from 'fs';
import * as path from 'path';
import * as flatten from 'flattenjs';

export type FileType = 'key-based' | 'natural' | 'auto';

export const getAvailableLanguages = (file: string) =>
  String(fs
    .readFileSync(file)).split('\n');

export const detectFileType = (json: any): FileType => {
  const invalidKeys = Object.keys(json).filter(
    k => typeof json[k] === 'string' && (k.includes('.') || k.includes(' ')),
  );

  return invalidKeys.length > 0 ? 'natural' : 'key-based';
};

export const loadTranslation = (
  directory: string,
  f: string,
  fileType: FileType = 'auto',
) => {
  const json = require(path.resolve(directory, f));
  const type = fileType === 'auto' ? detectFileType(json) : fileType;

  return {
    name: f,
    originalContent: json,
    type,
    content:
      type === 'key-based'
        ? flatten.convert(require(path.resolve(directory, f)))
        : require(path.resolve(directory, f)),
  };
}
export const loadTranslations = (
  directory: string,
  fileType: FileType = 'auto',
) =>
  fs
    .readdirSync(directory)
    .filter(f => f.endsWith('.json'))
    .map(f => {
     return loadTranslation(directory, f, fileType)
    })

export const fixSourceInconsistencies = (
  directory: string,
  cacheDir: string,
) => {
  const files = loadTranslations(directory).filter(f => f.type === 'natural');

  for (const file of files) {
    const fixedContent = Object.keys(file.content).reduce(
      (acc, cur) => ({ ...acc, [cur]: cur }),
      {} as { [k: string]: string },
    );

    fs.writeFileSync(
      path.resolve(directory, file.name),
      JSON.stringify(fixedContent, null, 2) + '\n',
    );

    fs.writeFileSync(
      path.resolve(cacheDir, file.name),
      JSON.stringify(fixedContent, null, 2) + '\n',
    );
  }
};

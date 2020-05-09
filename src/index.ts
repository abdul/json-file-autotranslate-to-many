#!/usr/bin/env node

import chalk from 'chalk';
import commander from 'commander';
import * as flatten from 'flattenjs';
import * as fs from 'fs';
import { omit } from 'lodash';
import * as path from 'path';
import { diff } from 'deep-object-diff';
import ncp from 'ncp';

import { serviceMap } from './services';
import {
  loadTranslation,
  loadTranslations,
  getAvailableLanguages,
  fixSourceInconsistencies,
  FileType,
} from './util/file-system';
import { matcherMap } from './matchers';

require('dotenv').config();

commander
  .option(
    '-i, --input-file <inputFile>',
    'the input containing source language to be translated',
    'en.json',
  )
  .option(
    '-g, --locales-file <localesFile>',
    'the locales text file that contains target locale codes in different lines',
    'locales.txt',
  )
  .option(
    '--cache <cacheDir>',
    'set the cache directory',
    '.json-autotranslate-cache',
  )
  .option(
    '-l, --source-language <sourceLang>',
    'specify the source language',
    'en',
  )
  .option(
    '-t, --type <key-based|natural|auto>',
    `specify the file structure type`,
    /^(key-based|natural|auto)$/,
    'auto',
  )
  .option(
    '-s, --service <service>',
    `selects the service to be used for translation`,
    'google-translate',
  )
  .option('--list-services', `outputs a list of available services`)
  .option(
    '-m, --matcher <matcher>',
    `selects the matcher to be used for interpolations`,
    'icu',
  )
  .option('--list-matchers', `outputs a list of available matchers`)
  .option(
    '-c, --config <value>',
    'supply a config parameter (e.g. path to key file) to the translation service',
  )
  .option(
    '-f, --fix-inconsistencies',
    `automatically fixes inconsistent key-value pairs by setting the value to the key`,
  )
  .option(
    '-d, --delete-unused-strings',
    `deletes strings in translation files that don't exist in the template`,
  )
  .parse(process.argv);

const translate = async (
  iFile: string = 'en-us.json',
  localesFile: string = 'locales.txt',
  cacheDir: string = '.json-autotranslate-cache',
  sourceLang: string = 'en',
  deleteUnusedStrings = false,
  fileType: FileType = 'auto',
  fixInconsistencies = false,
  service: keyof typeof serviceMap = 'google-translate',
  matcher: keyof typeof matcherMap = 'icu',
  config?: string,
) => {
  console.log('iFile ', iFile);
  const inputFile = path.resolve(process.cwd(), iFile);
  const inputDir = path.parse(inputFile).dir;
  const translationsDir = path.resolve(process.cwd(), 'translations');
  const resolvedCacheDir = path.resolve(process.cwd(), cacheDir);
  const resolveLocalesFilePath = path.resolve(process.cwd(), localesFile);
  console.log(localesFile, resolveLocalesFilePath);
  const localeCodes = getAvailableLanguages(resolveLocalesFilePath);
  const targetLanguages = localeCodes.filter((f) => f !== sourceLang);

  if (!fs.existsSync(resolvedCacheDir)) {
    fs.mkdirSync(resolvedCacheDir);
    console.log(`🗂 Created the cache directory.`);
  }
  if (!fs.existsSync(translationsDir)) {
    fs.mkdirSync(translationsDir);
    console.log(`🗂 Created translations directory.`);
  }

  if (localeCodes.length === 0) {
    throw new Error(`The locales code file is empty.`);
  }

  if (typeof serviceMap[service] === 'undefined') {
    throw new Error(`The service ${service} doesn't exist.`);
  }

  if (typeof matcherMap[matcher] === 'undefined') {
    throw new Error(`The matcher ${matcher} doesn't exist.`);
  }

  const translationService = serviceMap[service];

  const templateFile = loadTranslation(
    inputDir,
    inputFile,
    fileType,
  );

  if (!templateFile) {
    throw new Error(
      `The source language ${sourceLang} doesn't contain any JSON files.`,
    );
  }

  console.log(
    chalk`Found {green.bold ${String(
      targetLanguages.length,
    )}} target language(s):`,
  );
  console.log(`-> ${targetLanguages.join(', ')}`);
  console.log();

  console.log(`🏭 Loading source files...`);
  console.log(chalk`├── ${String(templateFile.name)} (${templateFile.type})`);

  console.log(chalk`└── {green.bold Done}`);
  console.log();

  console.log(`✨ Initializing ${translationService.name}...`);
  await translationService.initialize(config, matcherMap[matcher]);
  console.log(chalk`└── {green.bold Done}`);
  console.log();

  if (!translationService.supportsLanguage(sourceLang)) {
    throw new Error(
      `${translationService.name} doesn't support the source language ${sourceLang}`,
    );
  }

  console.log(`🔍 Looking for key-value inconsistencies in source files...`);
  const insonsistentFiles: string[] = [];

  if(templateFile.type === 'natural') {
    const inconsistentKeys = Object.keys(templateFile.content).filter(
      (key) => key !== templateFile.content[key],
    );

    if (inconsistentKeys.length > 0) {
      insonsistentFiles.push(templateFile.name);
      console.log(
        chalk`├── {yellow.bold ${templateFile.name} contains} {red.bold ${String(
          inconsistentKeys.length,
        )}} {yellow.bold inconsistent key(s)}`,
      );
    }
  }

  if (insonsistentFiles.length > 0) {
    console.log(
      chalk`└── {yellow.bold Found key-value inconsistencies in} {red.bold ${String(
        insonsistentFiles.length,
      )}} {yellow.bold file(s).}`,
    );

    console.log();

    if (fixInconsistencies) {
      console.log(`💚 Fixing inconsistencies...`);
      fixSourceInconsistencies(
        inputDir,
        resolvedCacheDir,
      );
      console.log(chalk`└── {green.bold Fixed all inconsistencies.}`);
    } else {
      console.log(
        chalk`Please either fix these inconsistencies manually or supply the {green.bold -f} flag to automatically fix them.`,
      );
    }
  } else {
    console.log(chalk`└── {green.bold No inconsistencies found}`);
  }
  console.log();

  console.log(`🔍 Looking for invalid keys in source files...`);
  const invalidFiles: string[] = [];

  if( templateFile.type === 'key-based') {
    const invalidKeys = Object.keys(templateFile.originalContent).filter(
      (k) => typeof templateFile.originalContent[k] === 'string' && k.includes('.'),
    );

    if (invalidKeys.length > 0) {
      invalidFiles.push(templateFile.name);
      console.log(
        chalk`├── {yellow.bold ${templateFile.name} contains} {red.bold ${String(
          invalidKeys.length,
        )}} {yellow.bold invalid key(s)}`,
      );
    }
  }

  if (invalidFiles.length) {
    console.log(
      chalk`└── {yellow.bold Found invalid keys in} {red.bold ${String(
        invalidFiles.length,
      )}} {yellow.bold file(s).}`,
    );

    console.log();
    console.log(
      chalk`It looks like you're trying to use the key-based mode on natural-language-style JSON files.`,
    );
    console.log(
      chalk`Please make sure that your keys don't contain periods (.) or remove the {green.bold --type} / {green.bold -t} option.`,
    );
    console.log();
    process.exit(1);
  } else {
    console.log(chalk`└── {green.bold No invalid keys found}`);
  }
  console.log();

  let addedTranslations = 0;
  let removedTranslations = 0;

  const existingFiles = loadTranslations(
    path.resolve(translationsDir),
    fileType,
  );
  for (const language of targetLanguages) {
    if (!translationService.supportsLanguage(language)) {
      console.log(
        chalk`🙈 {yellow.bold ${translationService.name} doesn't support} {red.bold ${language}}{yellow.bold . Skipping this language.}`,
      );
      console.log();
      continue;
    }


    console.log(
      chalk`💬 Translating strings from {green.bold ${sourceLang}} to {green.bold ${language}}...`,
    );

    if (deleteUnusedStrings) {
      const templateFileNames = localeCodes.map((t) => path.resolve(translationsDir, `${t}.json`));
      const deletableFiles = existingFiles.filter(
        (f) => !templateFileNames.includes(f.name),
      );

      for (const file of deletableFiles) {
        console.log(
          chalk`├── {red.bold ${file.name} is no longer used and will be deleted.}`,
        );

        const languageFile = path.resolve(translationsDir, file.name);
        if (fs.existsSync(languageFile)) {
          fs.unlinkSync(languageFile);
        }

        const cacheFile = path.resolve(cacheDir, file.name);
        if (fs.existsSync(cacheFile)) {
          fs.unlinkSync(cacheFile);
        }
      }
    }

    process.stdout.write(`├── Translating ${language}`);

    const languageFile = existingFiles.find(
      (f) => f.name === `${language}.json`,
    );
    const existingKeys = languageFile
      ? Object.keys(languageFile.content)
      : [];
    const existingTranslations = languageFile ? languageFile.content : {};

    const cachePath = path.resolve(
      resolvedCacheDir,
      languageFile ? languageFile.name : '',
    );
    let cacheDiff: string[] = [];
    if (fs.existsSync(cachePath) && !fs.statSync(cachePath).isDirectory()) {
      const cachedFile = flatten.convert(
        JSON.parse(fs.readFileSync(cachePath).toString().trim()),
      );
      const cDiff = diff(cachedFile, languageFile.content);
      cacheDiff = Object.keys(cDiff).filter((k) => cDiff[k]);
      const changedItems = Object.keys(cacheDiff).length.toString();
      process.stdout.write(
        chalk` ({green.bold ${changedItems}} changes from cache)`,
      );
    }

    const templateStrings = Object.keys(templateFile.content);
    const stringsToTranslate = templateStrings
      .filter((key) => !existingKeys.includes(key) || cacheDiff.includes(key))
      .map((key) => ({
        key,
        value:
          templateFile.type === 'key-based' ? templateFile.content[key] : key,
      }));

    const unusedStrings = existingKeys.filter(
      (key) => !templateStrings.includes(key),
    );

    const translatedStrings = await translationService.translateStrings(
      stringsToTranslate,
      sourceLang,
      language,
    );

    const newKeys = translatedStrings.reduce(
      (acc, cur) => ({ ...acc, [cur.key]: cur.translated }),
      {} as { [k: string]: string },
    );

    addedTranslations += translatedStrings.length;
    removedTranslations += deleteUnusedStrings ? unusedStrings.length : 0;

    if (service !== 'dry-run') {
      const translatedFile = {
        ...omit(
          existingTranslations,
          deleteUnusedStrings ? unusedStrings : [],
        ),
        ...newKeys,
      };

      const newContent =
        JSON.stringify(
          templateFile.type === 'key-based'
            ? flatten.undo(translatedFile)
            : translatedFile,
          null,
          2,
        ) + `\n`;

      fs.writeFileSync(
        path.resolve(translationsDir, `${language}.json`),
        newContent,
      );

      const languageCachePath = path.resolve(resolvedCacheDir, `${language}.json`);
      fs.writeFileSync(
        languageCachePath,
        JSON.stringify(translatedFile, null, 2) + '\n',
      );
    }

    console.log(
      deleteUnusedStrings && unusedStrings.length > 0
        ? chalk` ({green.bold +${String(
        translatedStrings.length,
        )}}/{red.bold -${String(unusedStrings.length)}})`
        : chalk` ({green.bold +${String(translatedStrings.length)}})`,
    );
    console.log(chalk`└── {green.bold All strings have been translated.}`);
    console.log();
  }

  if (service !== 'dry-run') {
    console.log('🗂 Caching source translation files...');
    await new Promise((res, rej) =>
      ncp(
        inputDir,
        resolvedCacheDir,
        (err) => (err ? rej() : res()),
      ),
    );
    console.log(chalk`└── {green.bold Translation files have been cached.}`);
    console.log();
  }

  console.log(
    chalk.green.bold(`${addedTranslations} new translations have been added!`),
  );

  if (removedTranslations > 0) {
    console.log(
      chalk.green.bold(
        `${removedTranslations} translations have been removed!`,
      ),
    );
  }
};

if (commander.listServices) {
  console.log('Available services:');
  console.log(Object.keys(serviceMap).join(', '));
  process.exit(0);
}

if (commander.listMatchers) {
  console.log('Available matchers:');
  console.log(Object.keys(matcherMap).join(', '));
  process.exit(0);
}

translate(
  commander.inputFile,
  commander.localesFile,
  commander.cacheDir,
  commander.sourceLanguage,
  commander.deleteUnusedStrings,
  commander.type,
  commander.fixInconsistencies,
  commander.service,
  commander.matcher,
  commander.config,
).catch((e: Error) => {
  console.log();
  console.log(chalk.bgRed('An error has occured:'));
  console.log(chalk.bgRed(e.message));
  console.log(chalk.bgRed(e.stack));
  console.log();
});

![Node.js Package](https://github.com/abdul/json-file-autotranslate-to-many/workflows/json-file-autotranslate-to-many/badge.svg)

# json-file-autotranslate-to-many


This tool allows you to translate a JSON file (en-us.json)
into multiple languages (ar.json, de.json, etc.) using Google Translate, DeepL, Azure Translator, or
manually. You can either use the translation keys (natural translation) or their
values (key-based translation) as a source for translations.

If some of the strings have already been translated, they won't be translated
again. This improves performance and ensures that you won't accidentally lose
existing translations.

Interpolations (ICU: `{name}`, i18next: `{{name}}`, sprintf: `%s`) are replaced
by placeholders (e.g. `<0 />`) before being passed to the translation service,
so their structure doesn't get mangled by the translation.

## Installation

```shell
$ yarn add json-file-autotranslate-to-many
# or
$ npm i -S json-file-autotranslate-to-many
```

## Running json-autotranslate

```shell
$ yarn json-file-autotranslate-to-many
# or
$ npx json-file-autotranslate-to-many
```

### Usage Examples

Translate natural language source file located at `translations/en-us.json` using
Google Translate and delete existing keys in translated JSON files that are no
longer used.

```shell
$ yarn json-file-autotranslate-to-many -i translations/en-us.json -g locales.txt -d -c service-account.json
```

Manually translate key-based source files located in the `translations/en-us.json` 
directory.

```shell
$ yarn json-file-autotranslate-to-many -i translations/en-us.json -g locales.txt -s manual
```

Both of commands will translate the input file `translations/en-us.json` to all 
other languages that exist in locales.txt, and the translated lanugage files are 
renamed to `<language_code>.json` and copied to `translations` directory. 

## Locales Code File Structure

Your `locales.txt` directory should look like this:

```
locales.txt
ar
de
en
fr
it
```

By default, this tool will translate the input file from `en` to all 
other languages that exist in locales.txt. The input file must exist 
and should contain valid JSON.

### Translated Files

The Translated language file will be renamed to `<language_code>.json` is be 
placed inside `translations` directory. 

This is how `translations` directory structure look like:
```
translations
├── ar.json
├── de.json
├── en.json
├── fr.json
└── it.json
```

## File Structure

There are two ways that json-file-autotranslate-to-many can interpret files:

- Natural Language (`natural`)
- Key-Based (`key-based`)

If you don't specify a file structure type, json-file-autotranslate-to-many will
automatically determine the type on a per-file basis. In most cases, this is
sufficient.

### Natural Language

This is the default way that this tool will interpret your source files. The
keys will be used as the basis of translations. If one or more of the values in
your source files don't match their respective key, you'll see a warning as this
could indicate an inconsistency in your translations. You can fix those
inconsistencies by passing the `--fix-inconsistencies` flag.

```json
{
  "Your username doesn't exist.": "Your username doesn't exist.",
  "{email} is not a valid email address.": "{email} is not a valid email address."
}
```

### Key-Based

If you pass use the `keybased` option (`--type keybased`), this tool will use
the source file's values as the basis of translations. Keys can be nested, the
structure will be transfered over to the translated files as well.

```json
{
  "ERRORS": {
    "USERNAME": "Your username doesn't exist.",
    "EMAIL": "{email} is not a valid email address."
  },
  "LOGIN": "Login",
  "FORGOT_PASSWORD": "Forgot password?"
}
```

## Available Services

As of this release, json-file-autotranslate-to-many offers five services:

- **google-translate** (default, uses
  [Google Translate](https://translate.google.com) to translate strings)
- **deepl** (uses [DeepL](https://deepl.com) to translate strings)
- **azure** (uses Azure's
  [Translator Text](https://azure.microsoft.com/en-us/services/cognitive-services/translator-text-api/)
  to translate strings)
- **manual** (allows you to translate strings manually by entering them into the
  CLI)
- **dry-run** (outputs a list of strings that will be translated without
  touching any files)

You can select a service using the `-s` or `--service` option. If you specify
the `--list-services` flag, json-file-autotranslate-to-many will output a list of all
available services.

### Google Translate

To use this tool with Google Translate, you need to obtain valid credentials
from Google. Follow these steps to get them:

1.  [Select or create a Cloud Platform project][projects]
2.  [Enable billing for your project][billing] (optional, I think)
3.  [Enable the Google Cloud Translation API][enable_api]
4.  [Set up authentication with a service account][auth] so you can access the
    API from your local workstation

[projects]: https://console.cloud.google.com/project
[billing]: https://support.google.com/cloud/answer/6293499#enable-billing
[enable_api]:
  https://console.cloud.google.com/flows/enableapi?apiid=translate.googleapis.com
[auth]: https://cloud.google.com/docs/authentication/getting-started

You can specify the location of your downloaded JSON key file using the `-c` or
`--config` option.

### DeepL

To use this tool with DeepL, you need to obtain an API key from their website.
API keys are only available to DeepL Pro API users. If you don't have a
Developer account yet, you can create one
[here](https://www.deepl.com/en/pro.html#developer).

DeepL charges a fixed monthly price plus a variable fee for every 500 translated
characters.

After you have completed your sign-up, you can pass the API key to
json-file-autotranslate-to-many using the `-c` or `--config` option.

### Azure Translator Text

To use this tool with Azure's Translator Text, you need to obtain an API key
from their website. [Sign Up](https://azure.microsoft.com/en-us/free/) for an
Azure account if you don't have one already and
[create a new translator instance](https://portal.azure.com/#create/Microsoft.CognitiveServicesTextTranslation).
You'll get an API key soon after that which you can pass to json-autotranslate
using the `-c` or `--config` flag.

As of now, the first 2M characters of translation per month are free. After that
you'll have to pay \$10 per 1M characters that you translate.

### Manual

This service doesn't require any configuration. You will be prompted to
translate the source strings manually in the console.

## Available Matchers

Matchers are used to replace interpolations with placeholders before they are
sent to the translation service. This ensures that interpolations don't get
scrambled in the process. As of this release, json-file-autotranslate-to-many offers four
matchers for different styles of interpolation:

- **icu** (default, matches [ICU MessageFormat](https://translate.google.com)
  interpolations)
- **i18next** (matches
  [i18next](https://www.i18next.com/translation-function/interpolation)
  interpolations)
- **sprintf** (matches sprintf-style interpolations like `%s`)
- **none** (doesn't match any interpolations)

You can select a matchers using the `-m` or `--matcher` option. If you specify
the `--list-matchers` flag, json-file-autotranslate-to-many will output a list of all
available matchers.

## Available Options

```
Options:
  -i, --input <inputFile>              the input containing source language to be translated
  -g, --locales-file <localesFile>     the locales text file that contains target locale codes in different lines
  -l, --source-language <sourceLang>   specify the source language (default: "en")
  -t, --type <key-based|natural|auto>  specify the file structure type (default: "auto")
  -s, --service <service>              selects the service to be used for translation (default: "google-translate")
  --list-services                      outputs a list of available services
  -m, --matcher <matcher>              selects the matcher to be used for interpolations (default: "icu")
  --list-matchers                      outputs a list of available matchers
  -c, --config <value>                 supply a config parameter (e.g. path to key file) to the translation service
  -f, --fix-inconsistencies            automatically fixes inconsistent key-value pairs by setting the value to the key
  -d, --delete-unused-strings          deletes strings in translation files that don't exist in the template
  -h, --help                           output usage information
```

## Contributing

If you'd like to contribute to this project, please feel free to open a pull
request.

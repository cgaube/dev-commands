import { Command } from 'commander'
import { cancel, outro, text } from '@clack/prompts'
import Handlebars from 'handlebars'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { colorize, exitOnCancel, introTitle } from '#common/style'

type CreateOptions = {
  directory?: string
  output?: string
}

type TemplateContext = {
  packageName: string
  outputDir: string
}

type TemplateFile = {
  sourcePath: string
  relativeOutputPath: string
  renderAsTemplate: boolean
}

const templateDirectory = fileURLToPath(
  new URL('../templates', import.meta.url),
)

function isDirectory(path: string) {
  return stat(path)
    .then((result) => result.isDirectory())
    .catch(() => false)
}

function parseTemplateFilePath(filename: string) {
  return filename.replace(/\.hbs$/, '')
}

function expandHomePath(path: string) {
  if (path === '~') {
    return homedir()
  }
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2))
  }
  return path
}

async function writeTemplateFile(
  sourcePath: string,
  destinationPath: string,
  context: TemplateContext,
  renderAsTemplate: boolean,
) {
  const templateContent = await readFile(sourcePath, 'utf8')
  const renderedContent = renderAsTemplate
    ? Handlebars.compile(templateContent)(context)
    : templateContent

  await mkdir(dirname(destinationPath), { recursive: true })
  await writeFile(destinationPath, renderedContent, 'utf8')
}

async function getTemplateFilesRecursively(
  directory: string,
  rootDirectory: string = directory,
  accumulator: TemplateFile[] = [],
) {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      await getTemplateFilesRecursively(entryPath, rootDirectory, accumulator)
      continue
    }

    if (entry.isFile()) {
      const relativeTemplatePath = relative(rootDirectory, entryPath)
      const renderAsTemplate = entry.name.endsWith('.hbs')

      accumulator.push({
        sourcePath: entryPath,
        relativeOutputPath: renderAsTemplate
          ? parseTemplateFilePath(relativeTemplatePath)
          : relativeTemplatePath,
        renderAsTemplate,
      })
    }
  }

  return accumulator
}

export function createCreateCommand() {
  return new Command('create')
    .alias('generate')
    .description('create a new command package from our template')
    .option(
      '-d, --directory <path>',
      'directory where the package folder is created',
    )
    .option(
      '-o, --output <path>',
      'output path used by the compile script in package.json',
    )
    .action(async (options: CreateOptions) => {
      introTitle('Create Package')

      const packageNameInput = await text({
        message: 'Package name',
        placeholder: 'my-command',
        validate(value) {
          const parsed = (value || '').trim()
          if (!parsed) {
            return 'Package name is required'
          }
          if (!/^[a-z0-9][a-z0-9-_]*$/.test(parsed)) {
            return 'Use lowercase letters, numbers, hyphens, and underscores only'
          }
        },
      })
      exitOnCancel(packageNameInput)
      if (typeof packageNameInput !== 'string') {
        return
      }

      const packageName = packageNameInput.trim()

      const defaultDirectory = resolve(process.cwd())
      const directoryInput = options.directory
        ? options.directory
        : await text({
            message: 'Parent directory for the new package',
            placeholder: defaultDirectory,
            defaultValue: defaultDirectory,
          })

      exitOnCancel(directoryInput)
      if (typeof directoryInput !== 'string') {
        return
      }

      const defaultOutput = '~/devcommands'
      const outputDirInput = options.output
        ? options.output
        : await text({
            message: 'Compile output path',
            placeholder: defaultOutput,
            defaultValue: defaultOutput,
          })

      exitOnCancel(outputDirInput)

      if (typeof outputDirInput !== 'string') {
        return
      }

      const parentDirectory = resolve(expandHomePath(directoryInput.trim()))
      const packageDirectory = join(parentDirectory, packageName)

      const outputDir = outputDirInput.trim()

      if (await isDirectory(packageDirectory)) {
        cancel(
          colorize`Package directory already exists: {dim ${packageDirectory}}`,
        )
        return
      }

      const templateFiles = await getTemplateFilesRecursively(templateDirectory)

      if (templateFiles.length === 0) {
        cancel(colorize`No templates found in {dim ${templateDirectory}}`)
        return
      }

      await mkdir(packageDirectory, { recursive: true })

      for (const templateFile of templateFiles) {
        const outputPath = join(
          packageDirectory,
          templateFile.relativeOutputPath,
        )

        await writeTemplateFile(
          templateFile.sourcePath,
          outputPath,
          {
            packageName,
            outputDir,
          },
          templateFile.renderAsTemplate,
        )
      }

      outro(
        colorize`Created package {green ${packageName}} in {dim ${packageDirectory}}`,
      )
    })
}

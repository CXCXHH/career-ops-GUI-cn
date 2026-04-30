#!/usr/bin/env node

/**
 * doctor.mjs — Setup validation for Career-Ops-GUI-cn
 * Checks all prerequisites and prints a pass/fail checklist.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const NPM_REGISTRIES = [
  { name: 'Aliyun', url: 'https://registry.npmmirror.com/' },
  { name: 'Tencent', url: 'https://mirrors.cloud.tencent.com/npm/' },
  { name: 'Official', url: 'https://registry.npmjs.org/' },
];
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// ANSI colors (only on TTY)
const isTTY = process.stdout.isTTY;
const green = (s) => isTTY ? `\x1b[32m${s}\x1b[0m` : s;
const red = (s) => isTTY ? `\x1b[31m${s}\x1b[0m` : s;
const yellow = (s) => isTTY ? `\x1b[33m${s}\x1b[0m` : s;
const dim = (s) => isTTY ? `\x1b[2m${s}\x1b[0m` : s;
const bold = (s) => isTTY ? `\x1b[1m${s}\x1b[0m` : s;

function runCommand(command, args, cwd, extraEnv = {}, showOutput = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf-8',
    stdio: showOutput ? 'inherit' : 'pipe',
    shell: true,
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  return {
    pass: result.status === 0,
    output: showOutput ? '' : [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    error: result.error ? result.error.message : '',
  };
}

function installNpmDependenciesWithRetry(cwd, label) {
  console.log(`\n${bold(`Installing ${label} dependencies...`)}`);

  for (const registry of NPM_REGISTRIES) {
    console.log(`  Trying ${registry.name} mirror: ${registry.url}`);
    const result = runCommand(
      npmCommand,
      ['install', '--registry', registry.url, '--no-fund', '--no-audit'],
      cwd,
      { npm_config_registry: registry.url },
      true
    );

    if (result.pass && existsSync(join(cwd, 'node_modules'))) {
      console.log(`  ${green(`✓ ${label} dependencies installed via ${registry.name} mirror`)}`);
      return { pass: true, registry: registry };
    }

    console.log(`  ${yellow(`✗ ${registry.name} mirror failed`)}`);
  }

  return {
    pass: false,
    error: 'All npm registries failed. Please check your network connection.',
  };
}

function ensureFileFromTemplate(targetPath, templatePath, label, missingFix) {
  if (existsSync(targetPath)) {
    return { pass: true, label: `${label} found` };
  }
  if (existsSync(templatePath)) {
    copyFileSync(templatePath, targetPath);
    return { pass: true, label: `${label} ready (auto-created from template)` };
  }
  return {
    pass: false,
    label: `${label} not found`,
    fix: missingFix,
  };
}

function getSystemBrowserExecutablePath() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

function checkNodeVersion() {
  const major = parseInt(process.versions.node.split('.')[0]);
  if (major >= 18) {
    return { pass: true, label: `Node.js >= 18 (v${process.versions.node})` };
  }
  return {
    pass: false,
    label: `Node.js >= 18 (found v${process.versions.node})`,
    fix: 'Install Node.js 18 or later from https://nodejs.org',
  };
}

function checkDependencies() {
  if (existsSync(join(projectRoot, 'node_modules'))) {
    return { pass: true, label: 'Root dependencies installed' };
  }
  const installResult = installNpmDependenciesWithRetry(projectRoot, 'root');
  if (installResult.pass && existsSync(join(projectRoot, 'node_modules'))) {
    return { pass: true, label: `Root dependencies installed (auto-installed via ${installResult.registry.name} mirror)` };
  }
  return {
    pass: false,
    label: 'Root dependencies not installed',
    fix: [
      '健康检查已尝试自动安装，但未成功。',
      ...NPM_REGISTRIES.map(({ url }) => `Run: npm install --registry=${url}`),
      installResult.error || '请检查网络、Node/npm 环境和镜像源可用性。',
    ],
  };
}

function checkGuiDependencies() {
  const guiRoot = join(projectRoot, 'gui');
  if (existsSync(join(guiRoot, 'node_modules'))) {
    return { pass: true, label: 'GUI dependencies installed' };
  }
  const installResult = installNpmDependenciesWithRetry(guiRoot, 'GUI');
  if (installResult.pass && existsSync(join(guiRoot, 'node_modules'))) {
    return { pass: true, label: `GUI dependencies installed (auto-installed via ${installResult.registry.name} mirror)` };
  }
  return {
    pass: false,
    label: 'GUI dependencies not installed',
    fix: [
      '健康检查已尝试自动安装，但未成功。',
      ...NPM_REGISTRIES.map(({ url }) => `Run: cd gui && npm install --registry=${url}`),
      installResult.error || '请检查网络、Node/npm 环境和镜像源可用性。',
    ],
  };
}

async function checkPlaywright() {
  const systemBrowser = getSystemBrowserExecutablePath();
  if (systemBrowser) {
    const browserName = /msedge\.exe$/i.test(systemBrowser) ? 'Microsoft Edge' : 'Google Chrome';
    return { pass: true, label: `System browser ready (${browserName})` };
  }

  try {
    const { chromium } = await import('playwright');
    const execPath = chromium.executablePath();
    if (existsSync(execPath)) {
      return { pass: true, label: 'Playwright chromium installed' };
    }
    console.log(`\n${bold('Installing Playwright chromium...')}`);
    const installResult = runCommand(npxCommand, ['playwright', 'install', 'chromium'], projectRoot, {}, true);
    if (installResult.pass) {
      const refreshedPath = chromium.executablePath();
      if (existsSync(refreshedPath)) {
        return { pass: true, label: 'Playwright chromium installed (auto-installed)' };
      }
    }
    return {
      pass: false,
      label: 'Playwright chromium not installed',
      fix: [
        '健康检查已尝试自动安装 Chromium，但未成功。',
        'Run: npx playwright install chromium',
        installResult.output || '请检查网络环境后重试。',
      ],
    };
  } catch {
    console.log(`\n${bold('Installing Playwright chromium...')}`);
    const installResult = runCommand(npxCommand, ['playwright', 'install', 'chromium'], projectRoot, {}, true);
    if (installResult.pass) {
      return { pass: true, label: 'Playwright chromium installed (auto-installed)' };
    }
    return {
      pass: false,
      label: 'Playwright chromium not installed',
      fix: [
        '健康检查已尝试自动安装 Chromium，但未成功。',
        'Run: npx playwright install chromium',
        installResult.output || '请检查网络环境后重试。',
      ],
    };
  }
}

function checkCv() {
  return ensureFileFromTemplate(
    join(projectRoot, 'cv.md'),
    join(projectRoot, 'templates', 'cv.example.md'),
    'cv.md',
    'Place your resume at cv.md or add templates/cv.example.md'
  );
}

function checkProfile() {
  return ensureFileFromTemplate(
    join(projectRoot, 'config', 'profile.yml'),
    join(projectRoot, 'config', 'profile.example.yml'),
    'config/profile.yml',
    [
      'Run: copy config/profile.example.yml config/profile.yml',
      'Then edit it with your details',
    ]
  );
}

function checkPortals() {
  return ensureFileFromTemplate(
    join(projectRoot, 'portals.yml'),
    join(projectRoot, 'templates', 'portals.example.yml'),
    'portals.yml',
    'Place your search config at portals.yml or add templates/portals.example.yml'
  );
}

function checkFonts() {
  const fontsDir = join(projectRoot, 'fonts');
  if (!existsSync(fontsDir)) {
    return {
      pass: false,
      label: 'fonts/ directory not found',
      fix: 'The fonts/ directory is required for PDF generation',
    };
  }
  try {
    const files = readdirSync(fontsDir);
    if (files.length === 0) {
      return {
        pass: false,
        label: 'fonts/ directory is empty',
        fix: 'The fonts/ directory must contain font files for PDF generation',
      };
    }
  } catch {
    return {
      pass: false,
      label: 'fonts/ directory not readable',
      fix: 'Check permissions on the fonts/ directory',
    };
  }
  return { pass: true, label: 'Fonts directory ready' };
}

function checkAutoDir(name) {
  const dirPath = join(projectRoot, name);
  if (existsSync(dirPath)) {
    return { pass: true, label: `${name}/ directory ready` };
  }
  try {
    mkdirSync(dirPath, { recursive: true });
    return { pass: true, label: `${name}/ directory ready (auto-created)` };
  } catch {
    return {
      pass: false,
      label: `${name}/ directory could not be created`,
      fix: `Run: mkdir ${name}`,
    };
  }
}

async function main() {
  console.log('\nCareer-Ops-GUI-cn doctor');
  console.log('================\n');

  const checks = [
    checkNodeVersion(),
    checkDependencies(),
    checkGuiDependencies(),
    await checkPlaywright(),
    checkCv(),
    checkProfile(),
    checkPortals(),
    checkFonts(),
    checkAutoDir('data'),
    checkAutoDir('output'),
    checkAutoDir('reports'),
  ];

  let failures = 0;

  for (const result of checks) {
    if (result.pass) {
      console.log(`${green('✓')} ${result.label}`);
    } else {
      failures++;
      console.log(`${red('✗')} ${result.label}`);
      const fixes = Array.isArray(result.fix) ? result.fix : [result.fix];
      for (const hint of fixes) {
        console.log(`  ${dim('→ ' + hint)}`);
      }
    }
  }

  console.log('');
  if (failures > 0) {
    console.log(`Result: ${failures} issue${failures === 1 ? '' : 's'} found. Fix them and run \`npm run doctor\` again.`);
    process.exit(1);
  } else {
    console.log('Result: All checks passed. You are ready to start the GUI project.');
    console.log('Suggested next steps: run `npm run api` and `npm run gui:dev`.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('doctor.mjs failed:', err.message);
  process.exit(1);
});

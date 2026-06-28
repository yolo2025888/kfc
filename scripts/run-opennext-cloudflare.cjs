#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const originalCpSync = fs.cpSync;

function copyRecursive(src, dest) {
  const stat = fs.lstatSync(src);

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

fs.cpSync = function patchedCpSync(src, dest, options = {}) {
  if (options.recursive && fs.existsSync(src) && fs.lstatSync(src).isDirectory()) {
    copyRecursive(src, dest);
    return;
  }

  return originalCpSync.call(fs, src, dest, options);
};

import('../node_modules/@opennextjs/cloudflare/dist/cli/index.js').catch((error) => {
  console.error(error);
  process.exit(1);
});
'use strict';

const fs = require('fs');
const path = require('path');

const staleApiDirs = ['about', 'article', 'global', 'blog-post'];
const apiRoot = path.join(__dirname, '..', 'src', 'api');

for (const dir of staleApiDirs) {
  fs.rmSync(path.join(apiRoot, dir), { recursive: true, force: true });
}

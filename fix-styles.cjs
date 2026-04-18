const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace yellow references that were originally indigo (theme)
    // We'll replace bg-yellow-600 -> bg-primary
    content = content.replace(/bg-yellow-600/g, 'bg-primary');
    content = content.replace(/bg-yellow-700/g, 'bg-primary/80');
    content = content.replace(/text-yellow-600/g, 'text-primary');
    content = content.replace(/border-yellow-200/g, 'border-primary/20');
    content = content.replace(/border-yellow-100/g, 'border-primary/10');
    content = content.replace(/border-yellow-600/g, 'border-primary');
    content = content.replace(/text-yellow-500/g, 'text-primary');
    content = content.replace(/focus:border-yellow-600/g, 'focus:border-primary');
    content = content.replace(/focus:ring-yellow-600/g, 'focus:ring-primary');
    content = content.replace(/hover:bg-yellow-50/g, 'hover:bg-primary/10');
    content = content.replace(/bg-yellow-50\/30/g, 'bg-primary/5');
    content = content.replace(/bg-yellow-50/g, 'bg-primary/10');
    content = content.replace(/text-\[\#FF9900\]/g, 'text-primary');
    content = content.replace(/border-\[\#FF9900\]/g, 'border-primary');
    content = content.replace(/bg-\[\#FF9900\]/g, 'bg-primary');
    content = content.replace(/fill-\[\#FF9900\]/g, 'fill-primary');
    
    // Replace light mode backgrounds with semantic colors
    content = content.replace(/bg-white/g, 'bg-background');
    content = content.replace(/bg-zinc-50/g, 'bg-background');
    content = content.replace(/bg-zinc-100/g, 'bg-card');
    content = content.replace(/text-zinc-900/g, 'text-white');
    content = content.replace(/text-zinc-800/g, 'text-white');
    content = content.replace(/text-zinc-700/g, 'text-zinc-300');
    
    // Remove dark: prefix since we are enforcing dark mode only
    content = content.replace(/dark:bg-zinc-950/g, '');
    content = content.replace(/dark:bg-zinc-900/g, '');
    content = content.replace(/dark:text-white/g, '');
    content = content.replace(/dark:bg-zinc-800/g, '');


    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
});

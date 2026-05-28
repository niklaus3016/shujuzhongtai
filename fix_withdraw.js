// 修复提现按钮状态问题
import fs from 'fs';
import path from 'path';

const filePath = path.join(path.dirname(new URL(import.meta.url).pathname), 'pages/Settings.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 修复 enabledValue 解析逻辑
content = content.replace(
  'const enabledValue = result?.enabled?.enabled;',
  'const enabledValue = result?.enabled?.enabled ?? result?.enabled ?? result?.status;'
);

// 修复 isEnabled 判断逻辑
content = content.replace(
  "const isEnabled = enabledValue === true || enabledValue === 'true' || enabledValue === 1 || enabledValue === '1';",
  "const isEnabled = enabledValue === true || enabledValue === 'true' || enabledValue === 1 || enabledValue === '1' || enabledValue === 'enabled';"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('修复完成！');
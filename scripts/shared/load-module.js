/**
 * 共享工具：通过 VM 沙箱加载 JS 文件并提取指定变量
 *
 * 适用于加载非 ES Module 的经典脚本（如数据文件），提取其顶层变量。
 * const/let 声明不会自动出现在 sandbox 上，因此需要显式读取。
 */
import { readFileSync } from 'fs';
import vm from 'vm';

/**
 * 加载 JS 文件并提取指定变量
 * @param {string|URL} filePath - 文件路径
 * @param {...string} varNames - 要提取的变量名列表
 * @returns {Object} 提取的变量键值对
 */
export function loadScript(filePath, ...varNames) {
  const code = readFileSync(filePath, 'utf-8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: String(filePath) });
  const result = {};
  for (const name of varNames) {
    try {
      result[name] = vm.runInContext(name, sandbox);
    } catch {
      result[name] = sandbox[name];
    }
  }
  return result;
}

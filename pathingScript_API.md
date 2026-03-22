# BetterGI pathingScript API 文档

基于 README.md 中的 C# 代码推理得出的 JS 脚本 API 调用方法。

---

## 一、全局变量

- **变量名**: `pathingScript` (小写 p)
- **说明**: BetterGI 脚本引擎提供的全局对象，用于操作 `User\AutoPathing` 目录下的文件

---

## 二、API 方法总览

| 方法名 | 功能描述 | 参数 | 返回值 |
|--------|----------|------|--------|
| `pathingScript.IsExists(subPath)` | 判断路径是否存在（文件/文件夹） | `subPath`: 相对于 User\AutoPathing 的子路径 | `boolean` |
| `pathingScript.IsFile(subPath)` | 判断路径是否为文件 | `subPath`: 相对于 User\AutoPathing 的子路径 | `boolean` |
| `pathingScript.IsFolder(subPath)` | 判断路径是否为文件夹 | `subPath`: 相对于 User\AutoPathing 的子路径 | `boolean` |
| `pathingScript.ReadPathSync(subPath)` | 读取目录下所有文件（非递归） | `subPath`: 相对于 User\AutoPathing 的子路径（默认空字符串） | 数组（需转换） |

---

## 三、方法详细说明与代码示例

### 1. IsExists(subPath)

判断 `User\AutoPathing` 目录下的路径是否存在（文件或文件夹均可）。

```javascript
// 检查文件夹是否存在
var mapsExists = pathingScript.IsExists("地方特产/稻妻");
log.info("地方特产/稻妻 是否存在: " + mapsExists);

// 检查文件是否存在
var configExists = pathingScript.IsExists("地方特产/稻妻/绯樱绣球/01-绯樱绣球-稻妻城-6个.json");
log.info("文件是否存在: " + configExists);
```

### 2. IsFile(subPath)

判断 `User\AutoPathing` 目录下的路径是否为文件。

```javascript
var isConfigFile = pathingScript.IsFile("地方特产/稻妻/绯樱绣球/01-绯樱绣球-稻妻城-6个.json");
log.info("是否为文件: " + isConfigFile);

// 检查文件夹路径（会返回 false）
var isFolderAsFile = pathingScript.IsFile("地方特产/稻妻/绯樱绣球");
log.info("文件夹视为文件: " + isFolderAsFile);
```

### 3. IsFolder(subPath)

判断 `User\AutoPathing` 目录下的路径是否为文件夹。

```javascript
var isMapsFolder = pathingScript.IsFolder("地方特产/稻妻/绯樱绣球");
log.info("是否为文件夹: " + isMapsFolder);

// 检查文件路径（会返回 false）
var isFileAsFolder = pathingScript.IsFolder("地方特产/稻妻/绯樱绣球/01-绯樱绣球-稻妻城-6个.json");
log.info("文件视为文件夹: " + isFileAsFolder);
```

### 4. ReadPathSync(subPath)

读取 `User\AutoPathing` 目录下指定文件夹的内容（非递归方式），返回所有文件和子文件夹。

**重要**: 返回值不是标准 JavaScript 数组，需要使用 `Array.from()` 转换后再使用。

```javascript
// 读取根目录下的所有内容
var rootContents = Array.from(pathingScript.ReadPathSync("") || []);
log.info("根目录内容数量: " + rootContents.length);

// 读取子目录下的内容
var mapsContents = Array.from(pathingScript.ReadPathSync("地方特产/稻妻/绯樱绣球") || []);
log.info("绯樱绣球目录内容: " + JSON.stringify(mapsContents));

// 遍历目录内容
mapsContents.forEach(function(filePath) {
    if (pathingScript.IsFile(filePath)) {
        log.info("文件: " + filePath);
    } else if (pathingScript.IsFolder(filePath)) {
        log.info("文件夹: " + filePath);
    }
});
```

---

## 四、完整业务场景示例

### 场景：遍历并加载所有地图配置文件

```javascript
(async function () {
    var targetPath = "地方特产/稻妻/绯樱绣球";

    // 检查目录是否存在
    if (!pathingScript.IsFolder(targetPath)) {
        log.warn("目录不存在: " + targetPath);
        return;
    }

    // 读取目录内容（必须使用 Array.from() 转换）
    var files = Array.from(pathingScript.ReadPathSync(targetPath) || []);

    // 过滤出 JSON 文件
    var jsonFiles = files.filter(function(filePath) {
        return filePath.toLowerCase().endsWith(".json");
    });

    log.info("找到 " + jsonFiles.length + " 个 JSON 文件");

    // 遍历处理每个文件
    jsonFiles.forEach(function(filePath, index) {
        log.info((index + 1) + ". " + filePath);
    });
})();
```

---

## 五、注意事项

1. **返回值转换**: `ReadPathSync()` 返回的不是标准数组，**必须**使用 `Array.from()` 转换：
   ```javascript
   var files = Array.from(pathingScript.ReadPathSync(path) || []);
   ```

2. **JSON.stringify 限制**: 由于返回的是 V8 引擎的特殊对象，**不要**使用 `JSON.stringify()` 序列化返回值，否则会显示 `undefined`。请先使用 `Array.from()` 转换后再使用。

3. **路径分隔符**: 返回的路径使用 `\` 分隔符（如 `地方特产\稻妻\绯樱绣球\01-xxx.json`）

4. **路径参数**: 所有方法的 `subPath` 参数都是相对于 `User\AutoPathing` 的子路径，不需要包含 `User\AutoPathing` 前缀

5. **异步环境**: 建议使用 `async function` 包裹代码

6. **无定时器**: BetterGI 的 V8 引擎不支持 `setTimeout`，不要使用定时器相关功能

---

## 六、版本信息

- 文档版本: v1.0
- 创建日期: 2026-03-12
- 基于: README.md 中的 C# 代码

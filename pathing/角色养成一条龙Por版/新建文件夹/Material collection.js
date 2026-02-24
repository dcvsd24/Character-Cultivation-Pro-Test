// 全局常量定义 - 冷却时间(毫秒)
const COOLDOWN_LOCAL = 46 * 60 * 60 * 1000; // 地方特产46小时冷却
const COOLDOWN_MAGIC = 12 * 60 * 60 * 1000; // 敌人与魔物12小时冷却
const COOLDOWN_WEAPONS1 = 12 * 60 * 60 * 1000; // 武器1材料12小时冷却
const COOLDOWN_WEAPONS2 = 12 * 60 * 60 * 1000; // 武器2材料12小时冷却
const ASSETS_BASE = "pathing"; // 根目录（BGI白名单目录）
const FOLDER_LOCAL = "地方特产"; // 地方特产文件夹
const FOLDER_MAGIC = "敌人与魔物"; // 敌人与魔物文件夹
const FOLDER_WEAPONS1 = "敌人与魔物"; 
const FOLDER_WEAPONS2 = "敌人与魔物";
const CONFIG_PATH = "config.json"; // 配置文件路径
const SCRIPT_COOLDOWN_RECORD = "script_cooldown_record.json"; // 脚本级别冷却记录文件（按脚本路径记录）
const EXECUTE_RECORD_PATH = "execute_record.txt"; // 执行记录文件
const MAPPING_PATH = "Mapping.json";// Mapping文件路径
const GRASS_GOD_KEYWORD = "有草神";// 草神路线关键词
const DEFAULT_LOCAL_COUNT = 4;// 特产数量默认值
const DEFAULT_UID = "未识别UID";// UID未识别时的兜底标识
const GRASS_GOD_ERROR_EXTRA = 8;// 有草神目录时额外增加的误差值
const fixedUsername = "⚠️ 未找到任何JSON路径脚本！请右键点击脚本。打开脚本所在目录,鼠标左键双击运行 SymLink.bat ，以创建文件夹链接pathing文件"; 
const fixedUsername2 = "⚠️请确保地图追踪 地方特产和敌人与魔物，已订阅或更新路径"; 

// 敌人与魔物材料阈值常量
const THRESHOLD_HIGH = 50; // 高阈值：<=50且>20
const THRESHOLD_LOW = 20;  // 低阈值：<=20
const PATH_COUNT_HIGH = 10; // 高阈值时执行路径数
const PATH_COUNT_LOW = 5;   // 低阈值时执行路径数

// ==================== 工具函数 ====================

function getNow() {
    return new Date().getTime();
}

function readJson(path, defaultVal = {}) {
    if (typeof file.readTextSync !== "function") {
        log.error("BGI方法readTextSync不可用");
        return defaultVal;
    }
    try {
        const content = file.readTextSync(path);
        if (!content || content.trim() === "") {
            log.warn(`文件${path}为空，使用默认值`);
            file.writeTextSync(path, JSON.stringify(defaultVal, null, 2));
            return defaultVal;
        }
        let parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            let mergedObj = {};
            parsed.forEach(item => {
                if (typeof item === "object" && item !== null) {
                    Object.assign(mergedObj, item);
                }
            });
            parsed = mergedObj;
        }
        if (Array.isArray(parsed) && parsed.length > 0 && path !== MAPPING_PATH) {
            parsed = parsed[0];
        }
        return parsed || defaultVal;
    } catch (error) {
        log.info(`文件${path}不存在或解析失败: ${error.message}，创建默认配置`);
        try {
            file.writeTextSync(path, JSON.stringify(defaultVal, null, 2));
        } catch (writeErr) {
            log.error(`创建${path}失败: ${writeErr.message}`);
        }
        return defaultVal;
    }
}

function getAllAliasesByStandardName(standardName) {
    const mappingList = readJson(MAPPING_PATH, []);
    if (!Array.isArray(mappingList) || mappingList.length === 0) {
        log.warn(`Mapping.json解析失败或为空，仅使用标准名称：${standardName}`);
        return [standardName];
    }
    const targetItem = mappingList.find(item => item.name === standardName);
    if (!targetItem || !Array.isArray(targetItem.alias)) {
        log.info(`Mapping.json中未找到【${standardName}】的别名配置，仅使用标准名称`);
        return [standardName];
    }
    const allNames = [...new Set([standardName, ...targetItem.alias])];
    log.info(`【${standardName}】匹配到所有别名：${JSON.stringify(allNames)}`);
    return allNames;
}

function extractLocalCountFromFileName(fileName) {
    const countMatch = fileName.match(/(\d+)个/);
    if (countMatch && countMatch[1]) {
        const count = parseInt(countMatch[1], 10);
        return isNaN(count) ? DEFAULT_LOCAL_COUNT : count;
    }
    return DEFAULT_LOCAL_COUNT;
}

function hasGrassGodDirScripts(scriptList) {
    return scriptList.some(script => script.path.includes(GRASS_GOD_KEYWORD));
}

function filterLocalScriptsByCount(scriptList, targetCount, isIncludeGrassGod = true) {
    let totalCount = 0;
    const needExecuteScripts = [];
    let errorValue = targetCount >= 45 ? 12 : 8;
    if (isIncludeGrassGod && hasGrassGodDirScripts(scriptList)) {
        errorValue += GRASS_GOD_ERROR_EXTRA;
        log.info(`📈 检测到有草神目录的脚本，额外增加${GRASS_GOD_ERROR_EXTRA}个误差值，总误差值变为：${errorValue}个`);
    }
    const totalTarget = targetCount + errorValue;
    log.info(`🎯 特产收集目标：${targetCount}个，误差值：${errorValue}个，累计需收集：${totalTarget}个`);

    for (const script of scriptList) {
        needExecuteScripts.push(script);
        totalCount += script.count;
        log.info(`🔢 加入脚本【${script.name}】- 单次数量：${script.count}个，累计：${totalCount}个`);
        if (totalCount >= totalTarget) {
            log.info(`✅ 累计数量已达${totalCount}个（≥${totalTarget}个），停止添加后续脚本`);
            break;
        }
    }
    log.info(`📊 特产脚本筛选结果：共扫描${scriptList.length}个，需执行${needExecuteScripts.length}个，预计收集${totalCount}个`);
    return needExecuteScripts;
}

function recursiveScanScriptFiles(scriptDir, isExcludeGrassGod = false) {
    let allScriptFiles = [];
    scriptDir = scriptDir.replace(/\\/g, "/");
    const scriptDirWithSlash = scriptDir.endsWith("/") ? scriptDir : `${scriptDir}/`;
    log.info(`📂 递归扫描目录：${scriptDir}（排除有草神路线：${isExcludeGrassGod}）`); 

    try {
        let allPaths = file.readPathSync(scriptDir);
        allPaths = Array.from(allPaths || []);

        for (const itemPath of allPaths) {
            const normalizedPath = itemPath.replace(/\\/g, "/");
            let fullPath = "";

            if (normalizedPath.startsWith(scriptDirWithSlash)) {
                fullPath = normalizedPath;
            } else if (normalizedPath.includes("/") && !normalizedPath.startsWith("./") && !normalizedPath.startsWith("/")) {
                fullPath = normalizedPath;
            } else {
                fullPath = `${scriptDirWithSlash}${normalizedPath}`;
            }
            fullPath = fullPath.replace(/\\/g, "/");

            if (typeof file.isFolder === "function" && file.isFolder(fullPath)) {
                const folderName = fullPath.split(/[\\/]/).pop() || "";
                if (isExcludeGrassGod && folderName.includes(GRASS_GOD_KEYWORD)) {
                    log.info(`🚫 排除有草神路线文件夹：${fullPath}`);
                    continue;
                }
                log.info(`📂 发现子目录：${fullPath}，递归扫描`);
                const subDirFiles = recursiveScanScriptFiles(fullPath, isExcludeGrassGod);
                allScriptFiles = allScriptFiles.concat(subDirFiles);
            } else {
                if (normalizedPath.toLowerCase().endsWith(".json")) {
                    const fileName = normalizedPath.split("/").pop() || normalizedPath;
                    const count = extractLocalCountFromFileName(fileName);
                    allScriptFiles.push({ path: fullPath, name: fileName, count: count });
                }
            }
        }
    } catch (e) {
        log.error(`扫描目录失败 [${scriptDir}]：${e.message}`);
    }
    return allScriptFiles;
}

// ==================== 核心功能函数 ====================

async function getCurrentAccountUid() {
    async function executeCheckWithRetry(task, taskName) {
        const maxRetries = 3;
        let retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                await task();
                break;
            } catch (e) {
                retryCount++;
                log.error(`❌ ${taskName}失败（第${retryCount}次重试）：${e.message}`);
                if (retryCount >= maxRetries) {
                    throw new Error(`${taskName}失败，已重试${maxRetries}次`);
                }
                await sleep(2000);
            }
        }
    }

    const checkResult = { accountUid: DEFAULT_UID };
    try {
        await executeCheckWithRetry(async () => {
            log.info("🔍 正在识别当前账号UID");
            log.info("📌 按下ESC打开派蒙菜单");
            keyPress("VK_ESCAPE");
            await sleep(2000);
            log.info("🔍 OCR识别UID（区域：x168,y195,w120,h27）");
            const uidRegion = RecognitionObject.ocr(168, 195, 120, 27);
            let capture = captureGameRegion();
            let ocrRes = capture.find(uidRegion);
            let rawUidText = ocrRes.text?.trim() || "";
            capture.dispose();
            checkResult.accountUid = rawUidText.replace(/[^0-9]/g, '');
            if (!checkResult.accountUid) {
                checkResult.accountUid = DEFAULT_UID;
            }
            log.info(`✅ 当前账号UID：${checkResult.accountUid}`);
            log.info("📌 按下ESC关闭派蒙菜单，返回主界面");
            keyPress("VK_ESCAPE");
            await sleep(1500);
        }, "当前账号UID识别");
    } catch (e) {
        log.error(`❌ UID识别失败：${e.message}，使用兜底标识${DEFAULT_UID}`);
        checkResult.accountUid = DEFAULT_UID;
    }
    return checkResult.accountUid;
}

/**
 * 检查单个脚本是否在冷却中
 * @param {string} scriptPath 脚本路径
 * @param {number} cooldown 冷却时间（毫秒）
 * @param {object} cooldownRecord 冷却记录对象
 * @param {string} currentUid 当前UID
 * @returns {boolean} true表示可以执行，false表示在冷却中
 */
function checkScriptCooldown(scriptPath, cooldown, cooldownRecord, currentUid) {
    const uidRecord = cooldownRecord[currentUid] || {};
    const lastExec = uidRecord[scriptPath] || 0;
    
    // 无冷却记录 → 可执行
    if (lastExec === 0) return true;
    
    const now = getNow();
    const elapsed = now - lastExec;
    const remaining = cooldown - elapsed;
    
    // 冷却时间未到 → 不可执行
    if (elapsed < cooldown) {
        log.info(`[${currentUid}] 脚本冷却中：${scriptPath.split('/').pop()}，已过${(elapsed/3600000).toFixed(1)}小时，还需${(remaining/3600000).toFixed(1)}小时`);
        return false;
    }
    
    // 冷却时间已到 → 可执行
    return true;
}

/**
 * 更新单个脚本的冷却记录
 * @param {string} scriptPath 脚本路径
 * @param {object} cooldownRecord 冷却记录对象
 * @param {string} currentUid 当前UID
 */
function updateScriptCooldown(scriptPath, cooldownRecord, currentUid) {
    if (!cooldownRecord[currentUid]) {
        cooldownRecord[currentUid] = {};
    }
    cooldownRecord[currentUid][scriptPath] = getNow();
    file.writeTextSync(SCRIPT_COOLDOWN_RECORD, JSON.stringify(cooldownRecord, null, 2));
    log.info(`[${currentUid}] 脚本冷却记录已更新: ${scriptPath.split('/').pop()}`);
}

/**
 * 清理已过冷却期的记录
 * @param {object} cooldownRecord 冷却记录对象
 * @param {string} currentUid 当前UID
 * @param {number} cooldown 冷却时间（毫秒）
 */
function cleanExpiredCooldownRecords(cooldownRecord, currentUid, cooldown) {
    if (!cooldownRecord[currentUid]) return;
    
    const uidRecord = cooldownRecord[currentUid];
    const now = getNow();
    let cleanedCount = 0;
    
    for (const scriptPath in uidRecord) {
        if (uidRecord.hasOwnProperty(scriptPath)) {
            const lastExec = uidRecord[scriptPath];
            const elapsed = now - lastExec;
            
            // 如果已过冷却期，删除该记录
            if (elapsed >= cooldown) {
                delete uidRecord[scriptPath];
                cleanedCount++;
            }
        }
    }
    
    // 如果该UID下没有记录了，删除该UID节点
    if (Object.keys(uidRecord).length === 0) {
        delete cooldownRecord[currentUid];
    }
    
    // 如果有清理记录，保存到文件
    if (cleanedCount > 0) {
        file.writeTextSync(SCRIPT_COOLDOWN_RECORD, JSON.stringify(cooldownRecord, null, 2));
        log.info(`[${currentUid}] 已清理${cleanedCount}条过期冷却记录`);
    }
}

/**
 * 过滤掉在冷却中的脚本
 * @param {array} scriptList 脚本列表
 * @param {number} cooldown 冷却时间
 * @param {object} cooldownRecord 冷却记录
 * @param {string} currentUid 当前UID
 * @returns {array} 过滤后的脚本列表
 */
function filterScriptsByCooldown(scriptList, cooldown, cooldownRecord, currentUid) {
    const availableScripts = [];
    const coolingScripts = [];
    
    for (const script of scriptList) {
        if (checkScriptCooldown(script.path, cooldown, cooldownRecord, currentUid)) {
            availableScripts.push(script);
        } else {
            coolingScripts.push(script.name);
        }
    }
    
    if (coolingScripts.length > 0) {
        log.info(`[${currentUid}] ${coolingScripts.length}个脚本在冷却中，已跳过：${coolingScripts.join(', ')}`);
    }
    
    log.info(`[${currentUid}] 脚本过滤结果：共${scriptList.length}个，可执行${availableScripts.length}个，冷却中${coolingScripts.length}个`);
    return availableScripts;
}

async function executeScripts(scriptList, startIndex, maxCount, currentUid, cooldown, cooldownRecord) {
    let isLastScriptSuccess = false;
    let isTaskCanceled = false;
    let executedCount = 0;
    const remainingScripts = [];

    const endIndex = maxCount > 0 ? Math.min(startIndex + maxCount, scriptList.length) : scriptList.length;

    for (let i = startIndex; i < endIndex; i++) {
        if (isTaskCanceled) {
            log.warn(`[执行终止] 检测到任务取消，停止执行剩余脚本`);
            for (let j = i; j < scriptList.length; j++) {
                remainingScripts.push(scriptList[j]);
            }
            break;
        }

        const script = scriptList[i];
        const isLast = i === endIndex - 1;
        try {
            log.info(`\n【执行第 ${i + 1}/${endIndex} 个脚本】`);
            log.info(`加载路径脚本：${script.path}`);
            await pathingScript.runFile(script.path);
            // 使用带UID的执行记录文件路径
            const uidRecordPath = `${EXECUTE_RECORD_PATH}_${currentUid}.txt`;
            file.writeTextSync(uidRecordPath, `${script.name}\n`, true);
            executedCount++;
            log.info(`✅ 脚本执行成功：${script.name}（预计获取${script.count || 0}个材料）`);
            
            // 更新该脚本的冷却记录
            if (cooldown && cooldownRecord) {
                updateScriptCooldown(script.path, cooldownRecord, currentUid);
            }
            
            if (isLast) isLastScriptSuccess = true;
            await sleep(500);
        } catch (e) {
            log.error(`❌ 脚本执行失败 [${script.name}]：${e.message}`);
            if (e.message.includes("A task was canceled") || e.message.includes("取消自动任务")) {
                isTaskCanceled = true;
                log.error(`[任务取消] 检测到手动取消任务，终止所有脚本执行`);
                for (let k = i; k < scriptList.length; k++) {
                    remainingScripts.push(scriptList[k]);
                }
            }
            if (isLast) isLastScriptSuccess = false;
            if (!isTaskCanceled) continue;
            else break;
        }
    }

    if (!isTaskCanceled && endIndex < scriptList.length) {
        for (let m = endIndex; m < scriptList.length; m++) {
            remainingScripts.push(scriptList[m]);
        }
    }

    return { isLastSuccess: isLastScriptSuccess, executedCount, remainingScripts };
}

async function performCharacterRecognition(materialType) {
    log.info(`📌 开始执行${materialType}的角色识别与材料计算流程...`);
    try {
        eval(file.readTextSync("examine.js"));
        await findCharacterAndGetLevel();
        log.info(`✅ ${materialType}角色识别与材料更新完成`);
        await sleep(2000);
    } catch (e) {
        log.error(`❌ ${materialType}角色识别失败：${e.message}`);
    }
}

/**
 * 读取执行记录，获取起始执行索引
 * @param {array} scriptList 脚本列表
 * @param {string} currentUid 当前UID
 * @returns {number} 起始索引
 */
async function getStartIndex(scriptList, currentUid) {
    const uidRecordPath = `${EXECUTE_RECORD_PATH}_${currentUid}.txt`;
    let startIndex = 0;

    try {
        const recordContent = await file.readText(uidRecordPath);
        if (recordContent) {
            // 解析记录（过滤非脚本名称行）
            const lines = recordContent.split("\n");
            const executedRecords = [];
            for (let i = 0; i < lines.length; i++) {
                const trimmedLine = lines[i].trim();
                if (trimmedLine !== "" && !trimmedLine.startsWith("[") && !trimmedLine.includes("执行完成")) {
                    executedRecords.push(trimmedLine);
                }
            }

            if (executedRecords.length > 0) {
                // 取最后一个记录作为起始点
                const lastScript = executedRecords[executedRecords.length - 1];
                
                // 在脚本列表中查找最后一个执行的脚本
                const targetIndex = scriptList.findIndex(script => script.name === lastScript);
                
                if (targetIndex !== -1) {
                    // 从下一个脚本开始执行
                    startIndex = targetIndex + 1;
                    log.info(`📌 检测到历史执行记录，最后执行：【${lastScript}】，从第${startIndex + 1}个脚本继续执行`);
                } else {
                    log.warn(`⚠️ 历史记录中的脚本【${lastScript}】未在当前列表中找到，从头执行`);
                    startIndex = 0;
                }
            } else {
                log.info("📌 执行记录为空，从头开始执行");
            }
        } else {
            log.info("📌 无执行记录，从头开始执行");
        }
    } catch (e) {
        log.error(`读取执行记录失败：${e.message}，从头执行`);
        startIndex = 0;
    }
    return startIndex;
}

// ==================== 材料采集流程封装 ====================

/**
 * 统一的材料采集流程控制器
 * @param {Object} options 配置选项
 * @param {string} options.type 材料类型: 'local' | 'magic' | 'weapons1' | 'weapons2'
 * @param {string} options.rootFolder 根文件夹路径
 * @param {string|string[]} options.keywords 关键词或关键词数组
 * @param {string} options.configKey 配置文件中数量对应的key
 * @param {boolean} options.isExcludeGrassGod 是否排除草神路线（仅地方特产有效）
 * @param {string} options.materialType 材料类型标识（用于日志）
 * @param {string} options.currentUid 当前UID
 * @param {Object} options.cooldownRecord 冷却记录对象
 * @returns {Promise<boolean>} 是否执行完成
 */
async function executeMaterialCollection(options) {
    // 使用解构赋值获取参数
    const {
        type,
        rootFolder,
        keywords,
        configKey,
        isExcludeGrassGod = false,
        materialType,
        currentUid,
        cooldownRecord
    } = options;

    log.info(`\n========== 开始处理${materialType} ==========`);

    // 读取当前需求量
    const config = readJson(CONFIG_PATH);
    const currentAmount = Number(config[configKey]) || 0;

    if (currentAmount <= 0 && type !== 'local') {
        log.info(`[${materialType}] 需求数量为0，跳过执行`);
        return false;
    }

    if (!keywords || (Array.isArray(keywords) && keywords.length === 0)) {
        log.info(`[${materialType}] 未配置关键词，跳过执行`);
        return false;
    }

    // 获取冷却时间
    let cooldown;
    switch(type) {
        case "local": cooldown = COOLDOWN_LOCAL; break;
        case "magic": cooldown = COOLDOWN_MAGIC; break;
        case "weapons1": cooldown = COOLDOWN_WEAPONS1; break;
        case "weapons2": cooldown = COOLDOWN_WEAPONS2; break;
        default: cooldown = 0;
    }

    // 扫描脚本文件
    const keywordList = Array.isArray(keywords) ? keywords : [keywords];
    let allScriptFiles = [];

    for (const keyword of keywordList) {
        let targetDirs = [];
        
        if (rootFolder === FOLDER_LOCAL) {
            const localRootDir = `${ASSETS_BASE}/${rootFolder}`.replace(/\\/g, "/");
            try {
                const regionDirs = file.readPathSync(localRootDir) || [];
                for (const regionDir of regionDirs) {
                    if (file.isFolder(regionDir)) {
                        const regionName = regionDir.split(/[\\/]/).pop();
                        const targetDir = `${localRootDir}/${regionName}/${keyword}`.replace(/\\/g, "/");
                        if (file.isFolder(targetDir)) {
                            targetDirs.push(targetDir);
                            log.info(`✅ 检测到有效路径：${targetDir}`);
                        }
                    }
                }
            } catch (e) {
                log.error(`读取目录失败：${e.message}`);
            }
        } else {
            const aliasList = getAllAliasesByStandardName(keyword);
            for (const alias of aliasList) {
                const aliasDir = `${ASSETS_BASE}/${rootFolder}/${alias}`.replace(/\\/g, "/");
                if (file.isFolder(aliasDir)) {
                    targetDirs.push(aliasDir);
                    log.info(`✅ 匹配到别名目录：${aliasDir}（关键词：${keyword}，匹配别名：${alias}）`);
                }
            }
        }

        // 去重targetDirs
        const uniqueTargetDirs = [...new Set(targetDirs)];
        for (const targetDir of uniqueTargetDirs) {
            const dirFiles = recursiveScanScriptFiles(targetDir, isExcludeGrassGod);
            allScriptFiles = allScriptFiles.concat(dirFiles);
        }
    }

    if (allScriptFiles.length === 0) {
        log.warn(`⚠️ 未找到${materialType}的JSON路径脚本`);
        return false;
    }

    log.info(`✅ 共扫描到 ${allScriptFiles.length} 个路径脚本文件`);

    // 过滤掉在冷却中的脚本
    const availableScripts = filterScriptsByCooldown(allScriptFiles, cooldown, cooldownRecord, currentUid);
    
    if (availableScripts.length === 0) {
        log.info(`[${materialType}] 所有脚本都在冷却中，跳过执行`);
        return false;
    }

    // 根据材料类型执行不同的控制逻辑
    let isCompleted = false;
    
    if (type === 'local') {
        // 地方特产：根据数量计算路径，执行后判断是否触发角色识别
        isCompleted = await executeLocalBatch(availableScripts, isExcludeGrassGod, materialType, currentUid, cooldown, cooldownRecord);
    } else {
        // 敌人与魔物/武器材料：阈值控制
        isCompleted = await executeMonsterBatch(availableScripts, configKey, materialType, currentUid, cooldown, cooldownRecord);
    }

    return isCompleted;
}

/**
 * 地方特产分批执行逻辑
 */
async function executeLocalBatch(allScripts, isExcludeGrassGod, materialType, currentUid, cooldown, cooldownRecord) {
    let remainingScripts = [...allScripts];
    let isCompleted = false;

    while (remainingScripts.length > 0) {
        const config = readJson(CONFIG_PATH);
        const currentNeed = Number(config["needLocalAmount"]) || 0;
        
        log.info(`\n📊 [${materialType}] 当前需求量：${currentNeed}，剩余脚本数：${remainingScripts.length}`);

        if (currentNeed <= 0) {
            log.info(`✅ [${materialType}] 需求已满足，停止执行`);
            isCompleted = true;
            break;
        }

        // 根据需求量筛选脚本
        const scriptsToExecute = filterLocalScriptsByCount(remainingScripts, currentNeed, !isExcludeGrassGod);
        
        if (scriptsToExecute.length === 0) {
            log.info(`⚠️ [${materialType}] 无需要执行的脚本`);
            break;
        }

        const totalCanGet = scriptsToExecute.reduce((sum, s) => sum + (s.count || DEFAULT_LOCAL_COUNT), 0);
        log.info(`🔢 [${materialType}] 本次计划执行${scriptsToExecute.length}个脚本，预计获取${totalCanGet}个特产`);

        // 执行脚本（传入冷却参数）
        const result = await executeScripts(scriptsToExecute, 0, 0, currentUid, cooldown, cooldownRecord);

        // 更新剩余脚本
        const executedPaths = new Set(scriptsToExecute.slice(0, result.executedCount).map(s => s.path));
        remainingScripts = remainingScripts.filter(s => !executedPaths.has(s.path));

        // 判断是否触发角色识别：路径数量 >= 需求量
        if (totalCanGet >= currentNeed) {
            log.info(`📌 [${materialType}] 本次执行路径数量(${totalCanGet}) >= 需求量(${currentNeed})，触发角色识别`);
            await performCharacterRecognition(materialType);
            
            const newConfig = readJson(CONFIG_PATH);
            const newNeed = Number(newConfig["needLocalAmount"]) || 0;
            
            if (newNeed <= 0) {
                log.info(`✅ [${materialType}] 需求已满足，停止执行`);
                isCompleted = true;
                break;
            }
        } else {
            log.info(`ℹ️ [${materialType}] 本次执行路径数量(${totalCanGet}) < 需求量(${currentNeed})，不触发角色识别`);
        }

        if (remainingScripts.length === 0) {
            log.info(`✅ [${materialType}] 所有路径已执行完毕`);
            isCompleted = true;
        }

        await sleep(1000);
    }

    return isCompleted;
}

/**
 * 敌人与魔物/武器材料分批执行逻辑（阈值控制）
 */
async function executeMonsterBatch(allScripts, configKey, materialType, currentUid, cooldown, cooldownRecord) {
    let remainingScripts = [...allScripts];
    let isCompleted = false;

    while (remainingScripts.length > 0) {
        const config = readJson(CONFIG_PATH);
        let currentAmount = Number(config[configKey]) || 0;
        
        log.info(`\n📊 [${materialType}] 当前材料需求量：${currentAmount}，剩余脚本数：${remainingScripts.length}`);

        if (currentAmount <= 0) {
            log.info(`✅ [${materialType}] 材料需求已满足，停止执行`);
            isCompleted = true;
            break;
        }

        // 确定本次执行的路径数量
        let batchSize = 0;
        let shouldTriggerRecognition = false;

        if (currentAmount <= THRESHOLD_LOW) {
            batchSize = PATH_COUNT_LOW;
            shouldTriggerRecognition = true;
            log.info(`🔢 [${materialType}] 材料数量<=${THRESHOLD_LOW}，执行${PATH_COUNT_LOW}个路径`);
        } else if (currentAmount <= THRESHOLD_HIGH) {
            batchSize = PATH_COUNT_HIGH;
            shouldTriggerRecognition = true;
            log.info(`🔢 [${materialType}] 材料数量<=${THRESHOLD_HIGH}且>${THRESHOLD_LOW}，执行${PATH_COUNT_HIGH}个路径`);
        } else {
            batchSize = PATH_COUNT_HIGH;
            shouldTriggerRecognition = false;
            log.info(`🔢 [${materialType}] 材料数量>${THRESHOLD_HIGH}，执行${PATH_COUNT_HIGH}个路径（不触发角色识别）`);
        }

        // 执行一批脚本（传入冷却参数）
        const result = await executeScripts(remainingScripts, 0, batchSize, currentUid, cooldown, cooldownRecord);
        remainingScripts = result.remainingScripts;

        if (remainingScripts.length === 0) {
            log.info(`✅ [${materialType}] 所有路径已执行完毕`);
            isCompleted = true;
            break;
        }

        // 触发角色识别（如果需要）
        if (shouldTriggerRecognition) {
            await performCharacterRecognition(materialType);
            const newConfig = readJson(CONFIG_PATH);
            const newAmount = Number(newConfig[configKey]) || 0;
            
            log.info(`📊 [${materialType}] 角色识别后材料需求量：${newAmount}`);
            
            if (newAmount <= 0) {
                log.info(`✅ [${materialType}] 材料需求已满足，停止执行剩余路径`);
                isCompleted = true;
                break;
            }
        }

        await sleep(1000);
    }

    return isCompleted;
}

// ==================== 配置提取函数 ====================

function extractAllMagicKeywords(config) {
    const magicKeywords = [];
    let index = 0;
    while (true) {
        const key = `Magic material${index}`;
        const value = config[key]?.trim() || "";
        if (!value) break;
        magicKeywords.push(value);
        index++;
    }
    return magicKeywords;
}

function extractAllWeapons1Keywords(config) {
    const weapons1Keywords = [];
    let index = 0;
    while (true) {
        const key = `Weapons1 material${index}`;
        const value = config[key]?.trim() || "";
        if (!value) break;
        weapons1Keywords.push(value);
        index++;
    }
    return weapons1Keywords;
}

function extractAllWeapons2Keywords(config) {
    const weapons2Keywords = [];
    let index = 0;
    while (true) {
        const key = `Weapons2 material${index}`;
        const value = config[key]?.trim() || "";
        if (!value) break;
        weapons2Keywords.push(value);
        index++;
    }
    return weapons2Keywords;
}

// ==================== 主函数 ====================

async function main() {
    log.info("===== BGI路径追踪脚本开始执行 =====");
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    log.info("📌 正在返回游戏主界面并校准...");
    await genshin.returnMainUi();
    setGameMetrics(1920, 1080, 1.25);

    
    // 识别UID
    const currentUid = await getCurrentAccountUid();
    log.info(`📌 当前运行账号UID：${currentUid}`);
    
    // 读取配置
    const config = readJson(CONFIG_PATH);
    const cooldownRecord = readJson(SCRIPT_COOLDOWN_RECORD, {});
    const isNoGrassGod = settings.isNoGrassGod || false; 
    log.info(`📌 草神路线配置：${isNoGrassGod ? "排除有草神路线" : "默认选择有草神路线"}`);

    // 清理所有材料类型的过期冷却记录
    log.info("📌 正在清理过期冷却记录...");
    cleanExpiredCooldownRecords(cooldownRecord, currentUid, COOLDOWN_LOCAL);
    cleanExpiredCooldownRecords(cooldownRecord, currentUid, COOLDOWN_MAGIC);
    cleanExpiredCooldownRecords(cooldownRecord, currentUid, COOLDOWN_WEAPONS1);
    cleanExpiredCooldownRecords(cooldownRecord, currentUid, COOLDOWN_WEAPONS2);

    // 提取配置参数
    const localKeyword = config["LocalSpecialties"] || "";
    const allMagicKeywords = extractAllMagicKeywords(config);
    const allWeapons1Keywords = extractAllWeapons1Keywords(config);
    const allWeapons2Keywords = extractAllWeapons2Keywords(config);

    log.info(`读取到配置：`);
    log.info(`- 地方特产：关键词[${localKeyword}]`);
    log.info(`- 敌人与魔物：${allMagicKeywords.length}个关键词`);
    log.info(`- 武器1材料：${allWeapons1Keywords.length}个关键词`);
    log.info(`- 武器2材料：${allWeapons2Keywords.length}个关键词`);

    try {
        // 使用统一的材料采集流程

        // 1. 地方特产
        if (localKeyword) {
            await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
            // 切换到采集队伍
            await genshin.switchParty(settings.teamName2);
            await executeMaterialCollection({
                type: 'local',
                rootFolder: FOLDER_LOCAL,
                keywords: localKeyword,
                configKey: 'needLocalAmount',
                isExcludeGrassGod: isNoGrassGod,
                materialType: '地方特产',
                currentUid,
                cooldownRecord
            });
            await sleep(1000);
        }

        // 2. 敌人与魔物
        if (allMagicKeywords.length > 0) {
            await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
            // 切换到战斗队伍
            await genshin.switchParty(settings.teamName);
            await executeMaterialCollection({
                type: 'magic',
                rootFolder: FOLDER_MAGIC,
                keywords: allMagicKeywords,
                configKey: 'needMonsterStar3',
                materialType: '敌人与魔物',
                currentUid,
                cooldownRecord
            });
            await sleep(1000);
        }

        // 3. 武器1材料
        if (allWeapons1Keywords.length > 0) {
            await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
            // 切换到战斗队伍
            await genshin.switchParty(settings.teamName);
            await executeMaterialCollection({
                type: 'weapons1',
                rootFolder: FOLDER_WEAPONS1,
                keywords: allWeapons1Keywords,
                configKey: 'needamount1 stars3',
                materialType: '武器1材料',
                currentUid,
                cooldownRecord
            });
            await sleep(1000);
        }

        // 4. 武器2材料
        if (allWeapons2Keywords.length > 0) {
            await genshin.tp(2297.6201171875,-824.5869140625);//传送到神像回血
            // 切换到战斗队伍
            await genshin.switchParty(settings.teamName);
            await executeMaterialCollection({
                type: 'weapons2',
                rootFolder: FOLDER_WEAPONS2,
                keywords: allWeapons2Keywords,
                configKey: 'needamount2 stars3',
                materialType: '武器2材料',
                currentUid,
                cooldownRecord
            });
        }

    } catch (globalErr) {
        if (globalErr.message.includes("A task was canceled") || globalErr.message.includes("取消自动任务")) {
            log.error(`[脚本终止] 检测到手动取消任务，脚本正常终止`);
        } else {
            log.error(`[脚本异常] 全局执行错误：${globalErr.message}`);
        }
    }

    log.info("===== BGI路径追踪脚本执行结束 =====");
}

// BGI脚本入口
main().catch(error => {
    if (error.message.includes("A task was canceled") || error.message.includes("取消自动任务")) {
        log.error(`[最终兜底] 任务被手动取消，脚本结束：${error.message}`);
    } else {
        log.error(`[最终兜底] 脚本全局异常: ${error.message}`);
    }
});

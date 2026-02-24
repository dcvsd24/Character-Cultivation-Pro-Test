// 主入口文件 - 角色养成一条龙Pro版
// 使用模块化架构，通过eval加载lib目录下的模块

log.info("开始加载模块...");

// 顶层直接eval加载模块 - 这是唯一正确的方式
eval(file.readTextSync("lib/constants.js"));
eval(file.readTextSync("lib/utils.js"));
eval(file.readTextSync("lib/taskManager.js"));
eval(file.readTextSync("lib/ocrHelper.js"));
eval(file.readTextSync("lib/navigation.js"));
eval(file.readTextSync("lib/combat.js"));
eval(file.readTextSync("lib/inventory.js"));
eval(file.readTextSync("lib/farming.js"));
eval(file.readTextSync("lib/collection.js"));
eval(file.readTextSync("lib/character.js"));

log.info("所有模块加载完成");

// 模块加载验证
function checkModulesLoaded() {
    const requiredModules = ['Constants', 'Utils', 'TaskManager', 'OcrHelper', 'Navigation', 'Combat', 'Inventory', 'Farming', 'Collection', 'Character'];
    const missingModules = [];
    
    for (const moduleName of requiredModules) {
        try {
            const moduleType = eval("typeof " + moduleName);
            if (moduleType === 'undefined') {
                missingModules.push(moduleName);
            }
        } catch (error) {
            missingModules.push(moduleName);
        }
    }
    
    if (missingModules.length > 0) {
        log.error("以下模块加载失败: " + missingModules.join(", "));
        return false;
    }
    return true;
}

// 主逻辑
const Main = async () => {
    try {
        // 验证模块加载
        if (!checkModulesLoaded()) {
            log.error("模块加载失败，脚本终止");
            return;
        }
        
        log.info("✅ 所有模块验证通过");
        
        // 检查霸王条款
        if (!settings.unfairContractTerms) {
            throw new Error('未签署霸王条款，无法使用');
        }
        
        // 加载已完成任务记录
        const completedTasks = await TaskManager.loadCompletedTasks();
        log.info(`已加载 ${Object.keys(completedTasks).length} 个已完成任务记录`);
        
        // 封装从config.json读取配置的通用函数
        function getConfigValue(key) {
            try {
                const configContent = file.readTextSync("config.json");
                const configData = JSON.parse(configContent);
                for (const item of configData) {
                    if (item.hasOwnProperty(key)) {
                        return item[key];
                    }
                }
                throw new Error(`未在config.json中找到${key}配置`);
            } catch (fileError) {
                throw new Error(`读取/解析config.json失败: ${fileError.message}`);
            }
        }
        
        // ========== 第一步：执行角色识别与材料计算流程 ==========
        log.info("📌 开始执行角色识别与材料计算流程...");
        await Character.findCharacterAndGetLevel();
        
        // ============== 材料刷取逻辑开始 ==============
        
        // 天赋书刷取逻辑
        for (let i = 0; i < 1; i++) {
            const talentBookName = eval(`settings.talentBookName${i}`);
            if (talentBookName != "无" && talentBookName) {
                try {
                    const talentBookConfigKey = `talentBookRequireCounts${i}`;
                    const talentBookCountsStr = getConfigValue(talentBookConfigKey);
                    let bookRequireCounts = Utils.parseAndValidateCounts(talentBookCountsStr, 3);
                    log.info(`天赋书${i + 1}方案解析成功: ${bookRequireCounts.join(', ')}`);
                    
                    const isCompleted = await TaskManager.isTaskCompleted("talent", talentBookName, bookRequireCounts);
                    if (isCompleted) {
                        Utils.addNotification(`天赋书${talentBookName} 已刷取至目标数量，跳过执行`);
                    } else {
                        await Farming.getTalentBook(talentBookName, bookRequireCounts);
                    }
                } catch (error) {
                    notification.send(`天赋书${talentBookName}刷取失败，错误信息: ${error.message}`);
                }
            } else {
                log.info(`没有选择刷取天赋书${i + 1}，跳过执行`);
            }
        }
        
        // 武器材料刷取逻辑
        for (let i = 0; i < 1; i++) {
            const weaponName = eval(`settings.weaponName${i}`);
            if (weaponName != "无" && weaponName) {
                try {
                    const weaponConfigKey = `weaponMaterialRequireCounts${i}`;
                    const weaponCountsStr = getConfigValue(weaponConfigKey);
                    let weaponRequireCounts = Utils.parseAndValidateCounts(weaponCountsStr, 4);
                    log.info(`武器材料${i + 1}方案解析成功: ${weaponRequireCounts.join(', ')}`);
                    
                    const isCompleted = await TaskManager.isTaskCompleted("wepon", weaponName, weaponRequireCounts);
                    if (isCompleted) {
                        Utils.addNotification(`武器材料${weaponName} 已刷取至目标数量，跳过执行`);
                    } else {
                        await Farming.getWeaponMaterial(weaponName, weaponRequireCounts);
                    }
                } catch (error) {
                    notification.send(`武器材料${weaponName}刷取失败，错误信息: ${error.message}`);
                }
            } else {
                log.info(`没有选择刷取武器材料${i + 1}，跳过执行`);
            }
        }
        
        // 首领材料刷取逻辑
        for (let i = 0; i < 1; i++) {
            const bossName = eval(`settings.bossName${i}`);
            if (bossName != "无" && bossName) {
                try {
                    const bossConfigKey = `bossRequireCounts${i}`;
                    const bossRequireCounts = getConfigValue(bossConfigKey);
                    
                    const isCompleted = await TaskManager.isTaskCompleted("boss", bossName, bossRequireCounts);
                    if (isCompleted) {
                        Utils.addNotification(`首领材料${bossName} 已刷取至目标数量，跳过执行`);
                    } else {
                        await Farming.getBossMaterial(bossName, bossRequireCounts);
                    }
                } catch (error) {
                    notification.send(`首领材料${bossName}刷取失败，错误信息: ${error.message}`);
                }
            } else {
                log.info(`没有选择挑战首领${i + 1}，跳过执行`);
            }
        }
        
        Utils.sendBufferedNotifications();
        log.info("✅ 所有材料刷取逻辑执行完成");
        
        // 返回游戏主界面
        log.info("📌 正在校准并返回游戏主界面...");
        await genshin.returnMainUi();
        await sleep(1500);
        
        // ============== 最后一步：执行材料采集流程 ==========
        log.info("📌 开始执行材料采集流程...");
        await runMaterialCollection();
        
    } catch (globalError) {
        log.error(`❌ 整体流程执行失败: ${globalError.message}`);
        notification.send(`整体流程执行失败: ${globalError.message}`);
    }
};

// 材料采集主函数
async function runMaterialCollection() {
    log.info("===== BGI路径追踪脚本开始执行 =====");
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    log.info("📌 正在返回游戏主界面并校准...");
    await genshin.returnMainUi();
    setGameMetrics(1920, 1080, 1.25);
    
    // 识别UID
    const currentUid = await Collection.getCurrentAccountUid();
    const maskedUid = Utils.maskUid(currentUid);
    log.info(`📌 当前运行账号UID：${maskedUid}`);
    
    // 读取配置
    const config = Utils.readJson(Constants.CONFIG_PATH);
    const cooldownRecord = Utils.readJson(Constants.SCRIPT_COOLDOWN_RECORD, {});
    const isNoGrassGod = settings.isNoGrassGod || false;
    log.info(`📌 草神路线配置：${isNoGrassGod ? "排除有草神路线" : "默认选择有草神路线"}`);
    
    // 清理所有材料类型的过期冷却记录
    log.info("📌 正在清理过期冷却记录...");
    Collection.cleanExpiredCooldownRecords(cooldownRecord, currentUid, Constants.COOLDOWN_LOCAL);
    Collection.cleanExpiredCooldownRecords(cooldownRecord, currentUid, Constants.COOLDOWN_MAGIC);
    Collection.cleanExpiredCooldownRecords(cooldownRecord, currentUid, Constants.COOLDOWN_WEAPONS1);
    Collection.cleanExpiredCooldownRecords(cooldownRecord, currentUid, Constants.COOLDOWN_WEAPONS2);
    
    // 提取配置参数
    const localKeyword = config["LocalSpecialties"] || "";
    const allMagicKeywords = Collection.extractAllMagicKeywords(config);
    const allWeapons1Keywords = Collection.extractAllWeapons1Keywords(config);
    const allWeapons2Keywords = Collection.extractAllWeapons2Keywords(config);
    
    log.info(`读取到配置：`);
    log.info(`- 地方特产：关键词[${localKeyword}]`);
    log.info(`- 敌人与魔物：${allMagicKeywords.length}个关键词`);
    log.info(`- 武器1材料：${allWeapons1Keywords.length}个关键词`);
    log.info(`- 武器2材料：${allWeapons2Keywords.length}个关键词`);
    
    try {
        // 1. 地方特产
        if (localKeyword) {
            await genshin.tp(2297.6201171875, -824.5869140625);
            await Utils.switchPartySafe(settings.teamName2);
            await executeMaterialCollection({
                type: 'local',
                rootFolder: Constants.FOLDER_LOCAL,
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
            await genshin.tp(2297.6201171875, -824.5869140625);
            await Utils.switchPartySafe(settings.teamName);
            await executeMaterialCollection({
                type: 'magic',
                rootFolder: Constants.FOLDER_MAGIC,
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
            await genshin.tp(2297.6201171875, -824.5869140625);
            await Utils.switchPartySafe(settings.teamName);
            await executeMaterialCollection({
                type: 'weapons1',
                rootFolder: Constants.FOLDER_WEAPONS1,
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
            await genshin.tp(2297.6201171875, -824.5869140625);
            await Utils.switchPartySafe(settings.teamName);
            await executeMaterialCollection({
                type: 'weapons2',
                rootFolder: Constants.FOLDER_WEAPONS2,
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

// 统一的材料采集流程控制器
async function executeMaterialCollection(options) {
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
    const config = Utils.readJson(Constants.CONFIG_PATH);
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
    switch (type) {
        case "local": cooldown = Constants.COOLDOWN_LOCAL; break;
        case "magic": cooldown = Constants.COOLDOWN_MAGIC; break;
        case "weapons1": cooldown = Constants.COOLDOWN_WEAPONS1; break;
        case "weapons2": cooldown = Constants.COOLDOWN_WEAPONS2; break;
        default: cooldown = 0;
    }
    
    // 扫描脚本文件
    const keywordList = Array.isArray(keywords) ? keywords : [keywords];
    let allScriptFiles = [];
    
    for (const keyword of keywordList) {
        let targetDirs = [];
        
        if (rootFolder === Constants.FOLDER_LOCAL) {
            const localRootDir = `${Constants.ASSETS_BASE}/${rootFolder}`.replace(/\\/g, "/");
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
            const aliasList = Collection.getAllAliasesByStandardName(keyword);
            for (const alias of aliasList) {
                const aliasDir = `${Constants.ASSETS_BASE}/${rootFolder}/${alias}`.replace(/\\/g, "/");
                if (file.isFolder(aliasDir)) {
                    targetDirs.push(aliasDir);
                    log.info(`✅ 匹配到别名目录：${aliasDir}（关键词：${keyword}，匹配别名：${alias}）`);
                }
            }
        }
        
        const uniqueTargetDirs = [...new Set(targetDirs)];
        for (const targetDir of uniqueTargetDirs) {
            const dirFiles = Collection.recursiveScanScriptFiles(targetDir, isExcludeGrassGod);
            allScriptFiles = allScriptFiles.concat(dirFiles);
        }
    }
    
    if (allScriptFiles.length === 0) {
        log.warn(`⚠️ 未找到${materialType}的JSON路径脚本`);
        return false;
    }
    
    log.info(`✅ 共扫描到 ${allScriptFiles.length} 个路径脚本文件`);
    
    // 过滤掉在冷却中的脚本
    const availableScripts = Collection.filterScriptsByCooldown(allScriptFiles, cooldown, cooldownRecord, currentUid);
    
    if (availableScripts.length === 0) {
        log.info(`[${materialType}] 所有脚本都在冷却中，跳过执行`);
        return false;
    }
    
    // 根据材料类型执行不同的控制逻辑
    let isCompleted = false;
    
    if (type === 'local') {
        isCompleted = await executeLocalBatch(availableScripts, isExcludeGrassGod, materialType, currentUid, cooldown, cooldownRecord);
    } else {
        isCompleted = await executeMonsterBatch(availableScripts, configKey, materialType, currentUid, cooldown, cooldownRecord);
    }
    
    return isCompleted;
}

// 地方特产分批执行逻辑
async function executeLocalBatch(allScripts, isExcludeGrassGod, materialType, currentUid, cooldown, cooldownRecord) {
    let remainingScripts = [...allScripts];
    let isCompleted = false;
    
    while (remainingScripts.length > 0) {
        const config = Utils.readJson(Constants.CONFIG_PATH);
        const currentNeed = Number(config["needLocalAmount"]) || 0;
        
        log.info(`\n📊 [${materialType}] 当前需求量：${currentNeed}，剩余脚本数：${remainingScripts.length}`);
        
        if (currentNeed <= 0) {
            log.info(`✅ [${materialType}] 需求已满足，停止执行`);
            isCompleted = true;
            break;
        }
        
        const scriptsToExecute = Collection.filterLocalScriptsByCount(remainingScripts, currentNeed, !isExcludeGrassGod);
        
        if (scriptsToExecute.length === 0) {
            log.info(`⚠️ [${materialType}] 无需要执行的脚本`);
            break;
        }
        
        const totalCanGet = scriptsToExecute.reduce((sum, s) => sum + (s.count || Constants.DEFAULT_LOCAL_COUNT), 0);
        log.info(`🔢 [${materialType}] 本次计划执行${scriptsToExecute.length}个脚本，预计获取${totalCanGet}个特产`);
        
        const result = await Collection.executeScripts(scriptsToExecute, 0, 0, currentUid, cooldown, cooldownRecord);
        
        const executedPaths = new Set(scriptsToExecute.slice(0, result.executedCount).map(s => s.path));
        remainingScripts = remainingScripts.filter(s => !executedPaths.has(s.path));
        
        if (totalCanGet >= currentNeed) {
            log.info(`📌 [${materialType}] 本次执行路径数量(${totalCanGet}) >= 需求量(${currentNeed})，触发角色识别`);
            await performCharacterRecognition(materialType);
            
            const newConfig = Utils.readJson(Constants.CONFIG_PATH);
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

// 敌人与魔物/武器材料分批执行逻辑（阈值控制）
async function executeMonsterBatch(allScripts, configKey, materialType, currentUid, cooldown, cooldownRecord) {
    let remainingScripts = [...allScripts];
    let isCompleted = false;
    
    while (remainingScripts.length > 0) {
        const config = Utils.readJson(Constants.CONFIG_PATH);
        let currentAmount = Number(config[configKey]) || 0;
        
        log.info(`\n📊 [${materialType}] 当前材料需求量：${currentAmount}，剩余脚本数：${remainingScripts.length}`);
        
        if (currentAmount <= 0) {
            log.info(`✅ [${materialType}] 材料需求已满足，停止执行`);
            isCompleted = true;
            break;
        }
        
        let batchSize = 0;
        let shouldTriggerRecognition = false;
        
        if (currentAmount <= Constants.THRESHOLD_LOW) {
            batchSize = Constants.PATH_COUNT_LOW;
            shouldTriggerRecognition = true;
            log.info(`🔢 [${materialType}] 材料数量<=${Constants.THRESHOLD_LOW}，执行${Constants.PATH_COUNT_LOW}个路径`);
        } else if (currentAmount <= Constants.THRESHOLD_HIGH) {
            batchSize = Constants.PATH_COUNT_HIGH;
            shouldTriggerRecognition = true;
            log.info(`🔢 [${materialType}] 材料数量<=${Constants.THRESHOLD_HIGH}且>${Constants.THRESHOLD_LOW}，执行${Constants.PATH_COUNT_HIGH}个路径`);
        } else {
            batchSize = Constants.PATH_COUNT_HIGH;
            shouldTriggerRecognition = false;
            log.info(`🔢 [${materialType}] 材料数量>${Constants.THRESHOLD_HIGH}，执行${Constants.PATH_COUNT_HIGH}个路径（不触发角色识别）`);
        }
        
        const result = await Collection.executeScripts(remainingScripts, 0, batchSize, currentUid, cooldown, cooldownRecord);
        remainingScripts = result.remainingScripts;
        
        if (remainingScripts.length === 0) {
            log.info(`✅ [${materialType}] 所有路径已执行完毕`);
            isCompleted = true;
            break;
        }
        
        if (shouldTriggerRecognition) {
            await performCharacterRecognition(materialType);
            const newConfig = Utils.readJson(Constants.CONFIG_PATH);
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

// 执行角色识别
async function performCharacterRecognition(materialType) {
    log.info(`📌 开始执行${materialType}的角色识别与材料计算流程...`);
    try {
        await Character.findCharacterAndGetLevel();
        log.info(`✅ ${materialType}角色识别与材料更新完成`);
        await sleep(2000);
    } catch (e) {
        log.error(`❌ ${materialType}角色识别失败：${e.message}`);
    }
}

// 使用IIFE包装返回Promise
(async () => {
    // 定义全局唯一标识的锁变量，确保流程只执行一次
    if (typeof __genshinMaterialScriptExecuting === 'undefined') {
        __genshinMaterialScriptExecuting = false;
    }
    
    if (__genshinMaterialScriptExecuting) {
        log.info("⚠️ 脚本正在执行中，跳过重复触发");
        return;
    }
    __genshinMaterialScriptExecuting = true;
    
    try {
        await Main();
    } finally {
        __genshinMaterialScriptExecuting = false;
    }
})();

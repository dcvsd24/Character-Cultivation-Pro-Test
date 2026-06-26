// 主入口文件 - 角色养成一条龙Pro版
// 使用模块化架构，通过eval加载lib目录下的模块

log.info("开始加载模块...");

eval(file.readTextSync("lib/checkVersion.js"));

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
eval(file.readTextSync("lib/ui_navigator.js"));
eval(file.readTextSync("lib/calculator.js"));
eval(file.readTextSync("lib/image_recognition.js"));
eval(file.readTextSync("lib/file_utils.js"));
eval(file.readTextSync("lib/overlay.js"));
eval(file.readTextSync("lib/wiki.js"));

log.info("所有模块加载完成");

// 模块加载验证
function checkModulesLoaded() {
    const requiredModules = ['Constants', 'Utils', 'TaskManager', 'OcrHelper', 'Navigation', 'Combat', 'Inventory', 'Farming', 'Collection', 'Character', 'ImageRecognition', 'FileUtils', 'expCalculator', 'moraCalculation', 'resinCalculation'];
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

// 显示错误弹窗（通用函数）
// options: { title, message, timeout, showAgreeBtn, onAgree }
// 返回: true 表示用户同意（如果 showAgreeBtn 为 true），false 表示用户关闭或超时
async function showErrorModal(options = {}) {
    const {
        title = '错误',
        message = '发生未知错误',
        timeout = 20,
        showAgreeBtn = false,
        onAgree = null
    } = options;

    const warningWinId = htmlMask.show("assets/warning-modal.html", "warning-modal");
    htmlMask.setClickThrough(warningWinId, false);

    // 等待弹窗就绪
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;
    let userAgreed = false;
    let initSent = false;

    // 先等待弹窗发送 ready 消息
    while (htmlMask.exists(warningWinId)) {
        if (Date.now() - startTime >= timeoutMs) {
            htmlMask.close(warningWinId);
            break;
        }

        const msg = await htmlMask.receive(warningWinId, 1000);
        if (msg) {
            const parsed = JSON.parse(msg);
            if (parsed.url === '/ready') {
                // 弹窗已就绪，等待一小段时间确保消息处理设置完成
                await sleep(500);
                // 发送初始化数据
                if (!initSent) {
                    htmlMask.send(warningWinId, "/initError", JSON.stringify({
                        title: title,
                        message: message,
                        timeout: timeout,
                        showAgreeBtn: showAgreeBtn
                    }));
                    initSent = true;
                }
            } else if (parsed.url === '/close') {
                htmlMask.close(warningWinId);
                break;
            } else if (parsed.url === '/agree') {
                userAgreed = true;
                htmlMask.close(warningWinId);
                if (onAgree) {
                    await onAgree();
                }
                break;
            }
        }
    }

    return userAgreed;
}

// 根据用户输入的角色名称获取标准名称（从 combat_avatar.json）
function getStandardCharacterName(inputName) {
    if (!inputName) return null;
    try {
        const avatarData = JSON.parse(file.readTextSync("data/combat_avatar.json"));
        const normalizedInput = inputName.toLowerCase().trim();
        
        for (const avatar of avatarData) {
            // 检查标准名称
            if (avatar.name && avatar.name.toLowerCase() === normalizedInput) {
                return avatar.name;
            }
            // 检查别名数组
            if (avatar.alias && Array.isArray(avatar.alias)) {
                for (const alias of avatar.alias) {
                    if (alias.toLowerCase() === normalizedInput) {
                        return avatar.name;
                    }
                }
            }
        }
        return null;
    } catch (e) {
        log.error(`读取 combat_avatar.json 失败: ${e.message}`);
        return null;
    }
}

// 显示设置弹窗并等待用户操作（复用函数）
// 返回: savedSettings 对象（用户保存了设置）或 null（超时/取消）
// options.showAllZeroHint: 为 true 时显示"角色材料已全部收集完成"的黄色闪烁提示
async function showSettingsModal(currentSettings, options = {}) {
    const settingsWinId = htmlMask.show("assets/settings-modal.html", "settings-modal");
    htmlMask.setClickThrough(settingsWinId, false);

    const initSettingsData = JSON.stringify({
        Character: currentSettings.Character || "",
        bossRequireCounts: currentSettings.bossRequireCounts || "80级",
        weaponMaterialRequireCounts: currentSettings.weaponMaterialRequireCounts || "80级",
        talentBookRequireCounts: currentSettings.talentBookRequireCounts || "1-10-10",
        teamName: currentSettings.teamName || "",
        strategyName: currentSettings.strategyName || "",
        teamName2: currentSettings.teamName2 || "",
        isNoGrassGod: currentSettings.isNoGrassGod || false,
        energyMax: currentSettings.energyMax || false,
        unfairContractTerms: currentSettings.unfairContractTerms || false,
        checkVersionEnabled: currentSettings.checkVersionEnabled !== false,
        showSettingsOnStartup: currentSettings.showSettingsOnStartup || false,
        enableWikiDataFetch: currentSettings.enableWikiDataFetch || false,
        weaponName: currentSettings.weaponName || "",
        adventurePath: currentSettings.adventurePath || "蒙德",
        enableUidMask: currentSettings.enableUidMask || false,
        uidMaskPositionX: currentSettings.uidMaskPositionX || "0",
        uidMaskPositionY: currentSettings.uidMaskPositionY || "0",
        showAllZeroHint: options.showAllZeroHint || false
    });

    let startTime = Date.now();
    const timeoutMs = 30000;
    let savedSettings = null;
    let initSent = false;

    while (htmlMask.exists(settingsWinId)) {
        if (Date.now() - startTime >= timeoutMs) {
            htmlMask.close(settingsWinId);
            break;
        }

        const msg = await htmlMask.receive(settingsWinId, 1000);
        if (msg) {
            try {
                const parsed = JSON.parse(msg);
                if (parsed.url === '/ready') {
                    // HTML 已就绪，发送初始化设置数据
                    if (!initSent) {
                        htmlMask.send(settingsWinId, "/initSettings", initSettingsData);
                        initSent = true;
                    }
                } else if (parsed.url === '/close') {
                    htmlMask.close(settingsWinId);
                    let closeData = parsed.data;
                    if (typeof closeData === 'string') {
                        try { closeData = JSON.parse(closeData); } catch (e) {}
                    }
                    if (closeData && closeData.action === 'cancel') {
                        return null;
                    }
                    break;
                } else if (parsed.url === '/save') {
                    let saveData = parsed.data;
                    if (typeof saveData === 'string') {
                        try { saveData = JSON.parse(saveData); } catch (e) {}
                    }
                    savedSettings = saveData;
                    htmlMask.close(settingsWinId);
                    break;
                } else if (parsed.url === '/userActive') {
                    startTime = Date.now();
                }
            } catch (parseError) {
                if (msg === '/close') {
                    htmlMask.close(settingsWinId);
                    return null;
                }
            }
        }
    }
    
    if (savedSettings) {
        try {
            const userSettingsPath = "data/user_settings.json";
            file.writeTextSync(userSettingsPath, JSON.stringify(savedSettings, null, 2));
            
            settings.Character = savedSettings.Character;
            settings.bossRequireCounts = savedSettings.bossRequireCounts;
            settings.weaponMaterialRequireCounts = savedSettings.weaponMaterialRequireCounts;
            settings.talentBookRequireCounts = savedSettings.talentBookRequireCounts;
            settings.teamName = savedSettings.teamName;
            settings.strategyName = savedSettings.strategyName;
            settings.teamName2 = savedSettings.teamName2;
            settings.isNoGrassGod = savedSettings.isNoGrassGod;
            settings.energyMax = savedSettings.energyMax;
            settings.unfairContractTerms = savedSettings.unfairContractTerms;
            settings.checkVersionEnabled = savedSettings.checkVersionEnabled;
            settings.showSettingsOnStartup = savedSettings.showSettingsOnStartup;
            settings.enableWikiDataFetch = savedSettings.enableWikiDataFetch;
            settings.weaponName = savedSettings.weaponName || "";
            settings.adventurePath = savedSettings.adventurePath;
            settings.enableUidMask = savedSettings.enableUidMask;
            settings.uidMaskPositionX = savedSettings.uidMaskPositionX;
            settings.uidMaskPositionY = savedSettings.uidMaskPositionY;
            
            return savedSettings;
        } catch (saveError) {
            log.error(`保存设置失败: ${saveError.message}`);
            return null;
        }
    }
    
    return null;
}

// 主逻辑
const Main = async () => {
    try {
        await printVersion();

        if (!checkModulesLoaded()) {
            log.error("模块加载失败，脚本终止");
            return;
        }

        log.info("✅ 所有模块验证通过");

        // 初始化 HTML 遮罩
        let currentVersion = JSON.parse(file.readTextSync("manifest.json")).version;
        Overlay.initOverlay(currentVersion);
        
        // 设置总阶段数并启动计时
        Overlay.setTotalStages(12);
        Overlay.startTimer();
        
        // 显示遮罩
        await Overlay.showOverlay({
            stage: '准备中',
            status: '正在初始化...',
            percentage: 0,
            current: 0,
            total: 12,
            elapsedTime: '00分00秒'
        });
        
        // 初始化快捷键
        Overlay.initKeyHook();
        
        // BetterGI 的 settings 对象可能没有正确读取 default 值
        // 我们使用三层设置读取策略：
        // 1. 如果 settings 对象包含所有配置属性，说明用户在 BetterGI UI 界面配置过，优先使用 BetterGI UI 的值
        // 2. 如果 settings 对象缺少某些属性，优先读取 user_settings.json（用户通过遮罩面板设置的值）
        // 3. 如果都没有，读取 settings.json 的 default 字段（默认值）
        function loadSettingsFromJson() {
            try {
                // 先尝试读取 user_settings.json（用户通过遮罩面板设置的值）
                const userSettingsPath = "data/user_settings.json";
                let userSettings = null;
                try {
                    userSettings = JSON.parse(file.readTextSync(userSettingsPath));
                    log.info("读取到用户自定义设置文件 user_settings.json");
                } catch (e) {
                    // user_settings.json 不存在，忽略
                }
                
                // 读取 settings.json 的 default 字段
                const settingsJsonPath = "settings.json";
                const settingsJson = JSON.parse(file.readTextSync(settingsJsonPath));
                
                // 检查关键配置项是否是用户实际配置的
                // 关键配置项：Character, teamName, teamName2, unfairContractTerms
                // 这些配置项没有 default 值，所以只要有值就说明是用户配置的
                const requiredSettings = ['Character', 'teamName', 'teamName2', 'unfairContractTerms'];
                let hasUserConfiguredSettings = true;
                
                for (const name of requiredSettings) {
                    const currentValue = settings[name];
                    
                    // 检查是否有值
                    // 对于字符串类型：值不为空
                    // 对于布尔类型：值为 true
                    if (name === 'unfairContractTerms') {
                        // 布尔类型：必须为 true 才算配置过
                        if (!currentValue) {
                            hasUserConfiguredSettings = false;
                            log.info(`关键配置 ${name} 未被用户配置 (当前值: ${currentValue})`);
                            break;
                        }
                    } else {
                        // 字符串类型：值不为空
                        if (!currentValue || currentValue.trim() === '') {
                            hasUserConfiguredSettings = false;
                            log.info(`关键配置 ${name} 未被用户配置 (当前值: "${currentValue}")`);
                            break;
                        }
                    }
                }
                
                if (hasUserConfiguredSettings) {
                    // BetterGI 新功能会在脚本运行后保存 settings 对象
                    // 所以 settings 对象包含最新的配置（用户在弹窗中修改的配置会被 BetterGI 保存）
                    // 优先使用 settings 对象的配置，同时同步到 user_settings.json 作为备份
                    
                    log.info("使用 BetterGI 保存的最新配置（settings 对象）");
                    
                    // 将 settings 对象的配置同步保存到 user_settings.json 作为备份
                    // 这样即使 BetterGI 的保存功能出现问题，也能从 user_settings.json 恢复
                    try {
                        const settingsToSave = {};
                        for (const item of settingsJson) {
                            if (item.name && settings[item.name] !== undefined) {
                                settingsToSave[item.name] = settings[item.name];
                            }
                        }
                        file.writeTextSync(userSettingsPath, JSON.stringify(settingsToSave, null, 2));
                        log.info("已将当前配置同步保存到 user_settings.json 作为备份");
                    } catch (e) {
                        log.warn(`同步保存配置到 user_settings.json 失败: ${e.message}`);
                    }
                    
                    // 还需要检查其他非关键配置项是否有值，如果没有则从 default 读取
                    for (const item of settingsJson) {
                        if (item.name && item.default !== undefined && !requiredSettings.includes(item.name)) {
                            if (!settings.hasOwnProperty(item.name)) {
                                settings[item.name] = item.default;
                                log.info(`从 settings.json 读取 ${item.name}: "${item.default}"`);
                            }
                        }
                    }
                    return;
                }
                
                // settings 对象缺少某些属性，按优先级读取
                for (const item of settingsJson) {
                    if (item.name) {
                        // 如果 settings 对象中没有该属性（或值为 undefined/null），则按优先级读取
                        if (!settings.hasOwnProperty(item.name) || settings[item.name] === undefined || settings[item.name] === null) {
                            // 优先读取 user_settings.json
                            if (userSettings && userSettings[item.name] !== undefined) {
                                settings[item.name] = userSettings[item.name];
                                log.info(`从 user_settings.json 读取 ${item.name}: "${userSettings[item.name]}"`);
                            } else if (item.default !== undefined) {
                                // 否则读取 settings.json 的 default 字段
                                settings[item.name] = item.default;
                                log.info(`从 settings.json 读取 ${item.name}: "${item.default}"`);
                            }
                        }
                    }
                }
            } catch (e) {
                log.warn(`读取设置文件失败: ${e.message}`);
            }
        }
        
        // 加载设置
        loadSettingsFromJson();
        
        // 显示 UID 遮挡图片（如果启用）- 需要在 loadSettingsFromJson 之后调用
        if (settings.enableUidMask) {
            const uidMaskX = parseInt(settings.uidMaskPositionX) || 0;
            const uidMaskY = parseInt(settings.uidMaskPositionY) || 0;
            Overlay.showUidMask(uidMaskX, uidMaskY);
            log.info(`✅ UID遮挡已启用，位置: (${uidMaskX}, ${uidMaskY})`);
        }
        
        // 检查角色名称是否为空
        let inputCharacterName = settings.Character ? settings.Character.trim() : "";
        
        log.info(`当前角色名称: "${inputCharacterName}"`);
        
        // 如果启用了启动时弹出设置弹窗选项，则显示设置弹窗
        if (settings.showSettingsOnStartup) {
            log.info("📌 启用了启动时弹出设置弹窗选项，显示设置弹窗");
            const savedSettings = await showSettingsModal(settings, {});
            if (savedSettings) {
                inputCharacterName = savedSettings.Character ? savedSettings.Character.trim() : "";
                
                // 更新 UID 遮挡位置（如果已启用）
                if (settings.enableUidMask) {
                    const uidMaskX = parseInt(settings.uidMaskPositionX) || 0;
                    const uidMaskY = parseInt(settings.uidMaskPositionY) || 0;
                    Overlay.showUidMask(uidMaskX, uidMaskY);
                    log.info(`✅ UID遮挡位置已更新: (${uidMaskX}, ${uidMaskY})`);
                } else {
                    Overlay.closeUidMask();
                }
            } else {
                // 用户取消或超时
                if (!inputCharacterName) {
                    throw new Error('未配置角色名称，脚本终止');
                }
                log.info("📌 用户取消设置弹窗，使用现有配置继续运行");
            }
        }
        
        if (!inputCharacterName) {
            log.warn("角色名称为空，请先配置设置");
            
            // 显示设置遮罩弹窗
            const settingsWinId = htmlMask.show("assets/settings-modal.html", "settings-modal");
            htmlMask.setClickThrough(settingsWinId, false); // 使窗口可交互
            
            // 发送当前设置到遮罩
            htmlMask.send(settingsWinId, "/initSettings", JSON.stringify({
                Character: settings.Character || "",
                bossRequireCounts: settings.bossRequireCounts || "80级",
                weaponMaterialRequireCounts: settings.weaponMaterialRequireCounts || "80级",
                talentBookRequireCounts: settings.talentBookRequireCounts || "1-10-10",
                teamName: settings.teamName || "",
                strategyName: settings.strategyName || "",
                teamName2: settings.teamName2 || "",
                isNoGrassGod: settings.isNoGrassGod || false,
                energyMax: settings.energyMax || false,
                unfairContractTerms: settings.unfairContractTerms || false,
                checkVersionEnabled: settings.checkVersionEnabled !== false,
                showSettingsOnStartup: settings.showSettingsOnStartup || false,
                enableWikiDataFetch: settings.enableWikiDataFetch || false,
                weaponName: settings.weaponName || "",
                adventurePath: settings.adventurePath || "蒙德",
                enableUidMask: settings.enableUidMask || false,
                uidMaskPositionX: settings.uidMaskPositionX || "0",
                uidMaskPositionY: settings.uidMaskPositionY || "0"
            }));
            
            // 等待用户操作（最多30秒，用户操作时会延长）
            let startTime = Date.now();
            const timeoutMs = 30000;
            let savedSettings = null;
            
            while (htmlMask.exists(settingsWinId)) {
                // 检查是否超时
                if (Date.now() - startTime >= timeoutMs) {
                    htmlMask.close(settingsWinId);
                    break;
                }
                
                const msg = await htmlMask.receive(settingsWinId, 1000);
                if (msg) {
                    try {
                        const parsed = JSON.parse(msg);
                        if (parsed.url === '/close') {
                            htmlMask.close(settingsWinId);
                            // 解析 data 中的 action
                            let closeData = parsed.data;
                            if (typeof closeData === 'string') {
                                try { closeData = JSON.parse(closeData); } catch (e) {}
                            }
                            if (closeData && closeData.action === 'cancel') {
                                throw new Error('用户取消设置，脚本终止');
                            }
                            break;
                        } else if (parsed.url === '/save') {
                            // 解析 data 中的设置数据
                            let saveData = parsed.data;
                            if (typeof saveData === 'string') {
                                try { saveData = JSON.parse(saveData); } catch (e) {}
                            }
                            savedSettings = saveData;
                            htmlMask.close(settingsWinId);
                            break;
                        } else if (parsed.url === '/userActive') {
                            // 用户正在操作，重置超时时间
                            startTime = Date.now();
                        }
                    } catch (parseError) {
                        // 如果是脚本终止错误，直接抛出
                        if (parseError.message === '用户取消设置，脚本终止') {
                            throw parseError;
                        }
                        // 可能是简单的字符串消息
                        if (msg === '/close') {
                            htmlMask.close(settingsWinId);
                            throw new Error('用户取消设置，脚本终止');
                        }
                    }
                }
            }
            
            // 如果用户保存了设置，写入 user_settings.json（不修改 settings.json 的 default 字段）
            if (savedSettings) {
                try {
                    log.info(`收到保存的设置: ${JSON.stringify(savedSettings)}`);
                    
                    // 将用户设置保存到 user_settings.json
                    const userSettingsPath = "data/user_settings.json";
                    file.writeTextSync(userSettingsPath, JSON.stringify(savedSettings, null, 2));
                    log.info("✅ 设置已保存到 user_settings.json");
                    
                    // 更新当前运行时的 settings 对象
                    settings.Character = savedSettings.Character;
                    settings.bossRequireCounts = savedSettings.bossRequireCounts;
                    settings.weaponMaterialRequireCounts = savedSettings.weaponMaterialRequireCounts;
                    settings.talentBookRequireCounts = savedSettings.talentBookRequireCounts;
                    settings.teamName = savedSettings.teamName;
                    settings.strategyName = savedSettings.strategyName;
                    settings.teamName2 = savedSettings.teamName2;
                    settings.isNoGrassGod = savedSettings.isNoGrassGod;
                    settings.energyMax = savedSettings.energyMax;
                    settings.unfairContractTerms = savedSettings.unfairContractTerms;
                    settings.checkVersionEnabled = savedSettings.checkVersionEnabled;
                    settings.showSettingsOnStartup = savedSettings.showSettingsOnStartup;
                    settings.enableWikiDataFetch = savedSettings.enableWikiDataFetch;
                    settings.weaponName = savedSettings.weaponName || "";
                    settings.adventurePath = savedSettings.adventurePath;
                    settings.enableUidMask = savedSettings.enableUidMask;
                    settings.uidMaskPositionX = savedSettings.uidMaskPositionX;
                    settings.uidMaskPositionY = savedSettings.uidMaskPositionY;
                    
                    // 更新 UID 遮挡位置（如果已启用）
                    if (settings.enableUidMask) {
                        const uidMaskX = parseInt(settings.uidMaskPositionX) || 0;
                        const uidMaskY = parseInt(settings.uidMaskPositionY) || 0;
                        Overlay.showUidMask(uidMaskX, uidMaskY);
                        log.info(`✅ UID遮挡位置已更新: (${uidMaskX}, ${uidMaskY})`);
                    } else {
                        Overlay.closeUidMask();
                    }
                    
                    // 更新 inputCharacterName 变量
                    inputCharacterName = savedSettings.Character ? savedSettings.Character.trim() : "";
                    
                    log.info("设置已更新，继续运行脚本");
                } catch (saveError) {
                    log.error(`保存设置失败: ${saveError.message}`);
                    throw new Error('保存设置失败，脚本终止');
                }
            } else {
                throw new Error('未配置角色名称，脚本终止');
            }
        }
        
        // 设置角色名称（从 combat_avatar.json 获取标准名称）
        if (inputCharacterName) {
            const standardCharacterName = getStandardCharacterName(inputCharacterName);
            if (standardCharacterName) {
                Overlay.setCharacterName(standardCharacterName);
                log.info(`✅ 当前培养角色: ${standardCharacterName}`);
            } else {
                log.warn(`未找到角色 "${inputCharacterName}" 的标准名称`);
            }
        }
        
        // 检查霸王条款
        if (!settings.unfairContractTerms) {
            log.warn("{0}", Constants.ERROR_NO_README_MD);

            const userAgreed = await showErrorModal({
                title: '未签署霸王条款',
                message: '请先右键点击脚本名称选择 [ 打开脚本所在目录 ] 阅读README.md文档然后修改脚本自定义配置。',
                timeout: 15,
                showAgreeBtn: true,
                onAgree: async () => {
                    // 用户同意，保存设置到 user_settings.json
                    try {
                        const userSettingsPath = "data/user_settings.json";
                        let userSettings = {};
                        try {
                            userSettings = JSON.parse(file.readTextSync(userSettingsPath));
                        } catch (e) {
                            // 文件不存在，使用空对象
                        }
                        userSettings.unfairContractTerms = true;
                        file.writeTextSync(userSettingsPath, JSON.stringify(userSettings, null, 2));
                        settings.unfairContractTerms = true;
                        log.info("用户已同意霸王条款，设置已保存");
                    } catch (saveError) {
                        log.error(`保存霸王条款同意状态失败: ${saveError.message}`);
                    }
                }
            });

            if (!userAgreed) {
                throw new Error('未签署霸王条款，无法使用');
            }
        }
        
        // 加载已完成任务记录
        const completedTasks = TaskManager.loadCompletedTasks();
        log.info(`已加载 ${Object.keys(completedTasks).length} 个已完成任务记录`);
        
        // ========== Wiki 数据获取逻辑（如果启用）==========
        if (settings.enableWikiDataFetch) {
            log.info("📌 启用了从网页获取角色材料数据功能");
            Overlay.updateStage('Wiki数据获取', '正在从B站Wiki获取材料信息...', 8);
            
            try {
                const wikiMaterials = await WikiFetcher.getCharacterMaterials(inputCharacterName);
                
                if (wikiMaterials) {
                    log.info(`📌 Wiki 数据获取结果: Boss=${wikiMaterials.bossName}, 天赋怪物=${wikiMaterials.talentMobName}, 区域特产=${wikiMaterials.specialtyName}, 天赋书=${wikiMaterials.talentBookName}`);
                    
                    // 自动填充配置（使用正确的字段名称）
                    const configPath = Constants.CONFIG_PATH;
                    let configData = [];
                    try {
                        configData = JSON.parse(file.readTextSync(configPath));
                    } catch (e) {
                        configData = [];
                    }
                    
                    // 检查并填充 Boss 名称（字段名：bossMaterialName）
                    if (wikiMaterials.bossName) {
                        const bossConfigIndex = configData.findIndex(item => item.hasOwnProperty("bossMaterialName"));
                        if (bossConfigIndex !== -1) {
                            configData[bossConfigIndex]["bossMaterialName"] = wikiMaterials.bossName;
                            log.info(`✅ 已更新 Boss 名称: ${wikiMaterials.bossName}`);
                        } else {
                            configData.push({ "bossMaterialName": wikiMaterials.bossName });
                            log.info(`✅ 已添加 Boss 名称: ${wikiMaterials.bossName}`);
                        }
                    }
                    
                    // 检查并填充天赋怪物名称（字段名：Magic material0）
                    if (wikiMaterials.talentMobName) {
                        const mobConfigIndex = configData.findIndex(item => item.hasOwnProperty("Magic material0"));
                        if (mobConfigIndex !== -1) {
                            configData[mobConfigIndex]["Magic material0"] = wikiMaterials.talentMobName;
                            log.info(`✅ 已更新天赋怪物名称: ${wikiMaterials.talentMobName}`);
                        } else {
                            // 需要添加到包含 LocalSpecialties 的对象中
                            const localIndex = configData.findIndex(item => item.hasOwnProperty("LocalSpecialties"));
                            if (localIndex !== -1) {
                                configData[localIndex]["Magic material0"] = wikiMaterials.talentMobName;
                                log.info(`✅ 已添加天赋怪物名称到现有配置: ${wikiMaterials.talentMobName}`);
                            } else {
                                configData.push({ "Magic material0": wikiMaterials.talentMobName });
                                log.info(`✅ 已添加天赋怪物名称: ${wikiMaterials.talentMobName}`);
                            }
                        }
                    }
                    
                    // 检查并填充区域特产名称（字段名：LocalSpecialties）
                    if (wikiMaterials.specialtyName) {
                        const specialtyConfigIndex = configData.findIndex(item => item.hasOwnProperty("LocalSpecialties"));
                        if (specialtyConfigIndex !== -1) {
                            configData[specialtyConfigIndex]["LocalSpecialties"] = wikiMaterials.specialtyName;
                            log.info(`✅ 已更新区域特产名称: ${wikiMaterials.specialtyName}`);
                        } else {
                            configData.push({ "LocalSpecialties": wikiMaterials.specialtyName });
                            log.info(`✅ 已添加区域特产名称: ${wikiMaterials.specialtyName}`);
                        }
                    }
                    
                    // 检查并填充天赋书名称（字段名：talentDomainName）
                    if (wikiMaterials.talentBookName) {
                        const talentBookConfigIndex = configData.findIndex(item => item.hasOwnProperty("talentDomainName"));
                        if (talentBookConfigIndex !== -1) {
                            configData[talentBookConfigIndex]["talentDomainName"] = wikiMaterials.talentBookName;
                            log.info(`✅ 已更新天赋书名称: ${wikiMaterials.talentBookName}`);
                        } else {
                            configData.push({ "talentDomainName": wikiMaterials.talentBookName });
                            log.info(`✅ 已添加天赋书名称: ${wikiMaterials.talentBookName}`);
                        }
                    }
                    
                    // 获取武器星级信息
                    if (settings.weaponName) {
                        const weaponStar = await WikiFetcher.getWeaponStar(settings.weaponName);
                        if (weaponStar) {
                            // 检查并填充武器星级（字段名：weaponStar）
                            const weaponStarConfigIndex = configData.findIndex(item => item.hasOwnProperty("weaponStar"));
                            if (weaponStarConfigIndex !== -1) {
                                configData[weaponStarConfigIndex]["weaponStar"] = weaponStar;
                                log.info(`✅ 已更新武器星级: ${weaponStar}`);
                            } else {
                                // 需要添加到包含 weaponLevel 的对象中
                                const weaponLevelIndex = configData.findIndex(item => item.hasOwnProperty("weaponLevel"));
                                if (weaponLevelIndex !== -1) {
                                    configData[weaponLevelIndex]["weaponStar"] = weaponStar;
                                    log.info(`✅ 已添加武器星级到现有配置: ${weaponStar}`);
                                } else {
                                    configData.push({ "weaponStar": weaponStar });
                                    log.info(`✅ 已添加武器星级: ${weaponStar}`);
                                }
                            }
                        }
                        
                        // 获取武器材料信息
                        const weaponMaterials = await WikiFetcher.getWeaponMaterials(settings.weaponName);
                        if (weaponMaterials) {
                            log.info(`📌 武器材料获取结果: 秘境=${weaponMaterials.weaponDomainName}, 武器魔物1=${weaponMaterials.weapons1MobName}, 武器魔物2=${weaponMaterials.weapons2MobName}`);
                            
                            // 检查并填充武器秘境名称（字段名：weaponDomainName）
                            if (weaponMaterials.weaponDomainName) {
                                const weaponDomainConfigIndex = configData.findIndex(item => item.hasOwnProperty("weaponDomainName"));
                                if (weaponDomainConfigIndex !== -1) {
                                    configData[weaponDomainConfigIndex]["weaponDomainName"] = weaponMaterials.weaponDomainName;
                                    log.info(`✅ 已更新武器秘境名称: ${weaponMaterials.weaponDomainName}`);
                                } else {
                                    configData.push({ "weaponDomainName": weaponMaterials.weaponDomainName });
                                    log.info(`✅ 已添加武器秘境名称: ${weaponMaterials.weaponDomainName}`);
                                }
                            }
                            
                            // 检查并填充第一种武器魔物名称（字段名：Weapons1 material0）
                            if (weaponMaterials.weapons1MobName) {
                                const weapons1ConfigIndex = configData.findIndex(item => item.hasOwnProperty("Weapons1 material0"));
                                if (weapons1ConfigIndex !== -1) {
                                    configData[weapons1ConfigIndex]["Weapons1 material0"] = weaponMaterials.weapons1MobName;
                                    log.info(`✅ 已更新第一种武器魔物名称: ${weaponMaterials.weapons1MobName}`);
                                } else {
                                    // 需要添加到包含 needamount1 stars3 的对象中
                                    const needamount1Index = configData.findIndex(item => item.hasOwnProperty("needamount1 stars3"));
                                    if (needamount1Index !== -1) {
                                        configData[needamount1Index]["Weapons1 material0"] = weaponMaterials.weapons1MobName;
                                        log.info(`✅ 已添加第一种武器魔物名称到现有配置: ${weaponMaterials.weapons1MobName}`);
                                    } else {
                                        configData.push({ "Weapons1 material0": weaponMaterials.weapons1MobName });
                                        log.info(`✅ 已添加第一种武器魔物名称: ${weaponMaterials.weapons1MobName}`);
                                    }
                                }
                            }
                            
                            // 检查并填充第二种武器魔物名称（字段名：Weapons2 material0）
                            if (weaponMaterials.weapons2MobName) {
                                const weapons2ConfigIndex = configData.findIndex(item => item.hasOwnProperty("Weapons2 material0"));
                                if (weapons2ConfigIndex !== -1) {
                                    configData[weapons2ConfigIndex]["Weapons2 material0"] = weaponMaterials.weapons2MobName;
                                    log.info(`✅ 已更新第二种武器魔物名称: ${weaponMaterials.weapons2MobName}`);
                                } else {
                                    // 需要添加到包含 needamount2 stars3 的对象中
                                    const needamount2Index = configData.findIndex(item => item.hasOwnProperty("needamount2 stars3"));
                                    if (needamount2Index !== -1) {
                                        configData[needamount2Index]["Weapons2 material0"] = weaponMaterials.weapons2MobName;
                                        log.info(`✅ 已添加第二种武器魔物名称到现有配置: ${weaponMaterials.weapons2MobName}`);
                                    } else {
                                        configData.push({ "Weapons2 material0": weaponMaterials.weapons2MobName });
                                        log.info(`✅ 已添加第二种武器魔物名称: ${weaponMaterials.weapons2MobName}`);
                                    }
                                }
                            }
                        }
                    }
                    
                    // ========== Wiki 模式默认配置 ==========
                    // 由于 Wiki 模式无法识别角色，需要添加默认配置
                    log.info("📌 Wiki 模式：添加默认材料数量配置");
                    
                    // 默认天赋书数量：9-63-114
                    const talentBookDefaultIndex = configData.findIndex(item => item.hasOwnProperty("talentBookRequireCounts0"));
                    if (talentBookDefaultIndex === -1) {
                        configData.push({ "talentBookRequireCounts0": "9-63-114" });
                        log.info(`✅ 已添加默认天赋书数量配置: 9-63-114`);
                    }
                    
                    // 默认武器材料数量：5-14-12-5
                    const weaponMaterialDefaultIndex = configData.findIndex(item => item.hasOwnProperty("weaponMaterialRequireCounts0"));
                    if (weaponMaterialDefaultIndex === -1) {
                        configData.push({ "weaponMaterialRequireCounts0": "5-14-12-5" });
                        log.info(`✅ 已添加默认武器材料数量配置: 5-14-12-5`);
                    }
                    
                    // 默认首领材料数量：46
                    const bossMaterialDefaultIndex = configData.findIndex(item => item.hasOwnProperty("bossRequireCounts0"));
                    if (bossMaterialDefaultIndex === -1) {
                        configData.push({ "bossRequireCounts0": 46 });
                        log.info(`✅ 已添加默认首领材料数量配置: 46`);
                    }
                    
                    // 默认地方特产需求量：168（Wiki模式下，如果值为0也需要更新为默认值）
                    const needLocalAmountIndex = configData.findIndex(item => item.hasOwnProperty("needLocalAmount"));
                    const needLocalAmountValue = needLocalAmountIndex !== -1 ? configData[needLocalAmountIndex]["needLocalAmount"] : 0;
                    if (needLocalAmountIndex === -1 || Number(needLocalAmountValue) === 0) {
                        // 查找包含 LocalSpecialties 的对象
                        const localSpecialtiesIndex = configData.findIndex(item => item.hasOwnProperty("LocalSpecialties"));
                        
                        // 如果 needLocalAmount 存在于其他对象中且值为0，先删除它
                        if (needLocalAmountIndex !== -1 && Number(needLocalAmountValue) === 0) {
                            delete configData[needLocalAmountIndex]["needLocalAmount"];
                        }
                        
                        // 添加到包含 LocalSpecialties 的对象中
                        if (localSpecialtiesIndex !== -1) {
                            configData[localSpecialtiesIndex]["needLocalAmount"] = 168;
                            log.info(`✅ 已设置地方特产需求量配置: 168`);
                        } else {
                            configData.push({ "needLocalAmount": 168 });
                            log.info(`✅ 已添加地方特产需求量配置: 168`);
                        }
                    }
                    
                    // 默认敌人与魔物需求量：100（Wiki模式下，如果值为0也需要更新为默认值）
                    const needMonsterStar3Index = configData.findIndex(item => item.hasOwnProperty("needMonsterStar3"));
                    const needMonsterStar3Value = needMonsterStar3Index !== -1 ? configData[needMonsterStar3Index]["needMonsterStar3"] : 0;
                    if (needMonsterStar3Index === -1 || Number(needMonsterStar3Value) === 0) {
                        // 查找包含 Magic material0 的对象
                        const magicMaterialIndex = configData.findIndex(item => item.hasOwnProperty("Magic material0"));
                        
                        // 如果 needMonsterStar3 存在于其他对象中且值为0，先删除它
                        if (needMonsterStar3Index !== -1 && Number(needMonsterStar3Value) === 0) {
                            delete configData[needMonsterStar3Index]["needMonsterStar3"];
                        }
                        
                        // 添加到包含 Magic material0 的对象中
                        if (magicMaterialIndex !== -1) {
                            configData[magicMaterialIndex]["needMonsterStar3"] = 100;
                            log.info(`✅ 已设置敌人与魔物需求量配置: 100`);
                        } else {
                            configData.push({ "needMonsterStar3": 100 });
                            log.info(`✅ 已添加敌人与魔物需求量配置: 100`);
                        }
                    }
                    
                    // 默认武器1材料需求量：100（Wiki模式下，如果值为0也需要更新为默认值）
                    const needamount1Index = configData.findIndex(item => item.hasOwnProperty("needamount1 stars3"));
                    const needamount1Value = needamount1Index !== -1 ? configData[needamount1Index]["needamount1 stars3"] : 0;
                    if (needamount1Index === -1 || Number(needamount1Value) === 0) {
                        // 查找包含 Weapons1 material0 的对象
                        const weapons1Index = configData.findIndex(item => item.hasOwnProperty("Weapons1 material0"));
                        
                        // 如果 needamount1 stars3 存在于其他对象中且值为0，先删除它
                        if (needamount1Index !== -1 && Number(needamount1Value) === 0) {
                            delete configData[needamount1Index]["needamount1 stars3"];
                        }
                        
                        // 添加到包含 Weapons1 material0 的对象中
                        if (weapons1Index !== -1) {
                            configData[weapons1Index]["needamount1 stars3"] = 100;
                            log.info(`✅ 已设置武器1材料需求量配置: 100`);
                        } else {
                            configData.push({ "needamount1 stars3": 100 });
                            log.info(`✅ 已添加武器1材料需求量配置: 100`);
                        }
                    }
                    
                    // 默认武器2材料需求量：100（Wiki模式下，如果值为0也需要更新为默认值）
                    const needamount2Index = configData.findIndex(item => item.hasOwnProperty("needamount2 stars3"));
                    const needamount2Value = needamount2Index !== -1 ? configData[needamount2Index]["needamount2 stars3"] : 0;
                    if (needamount2Index === -1 || Number(needamount2Value) === 0) {
                        // 查找包含 Weapons2 material0 的对象
                        const weapons2Index = configData.findIndex(item => item.hasOwnProperty("Weapons2 material0"));
                        
                        // 如果 needamount2 stars3 存在于其他对象中且值为0，先删除它
                        if (needamount2Index !== -1 && Number(needamount2Value) === 0) {
                            delete configData[needamount2Index]["needamount2 stars3"];
                        }
                        
                        // 添加到包含 Weapons2 material0 的对象中
                        if (weapons2Index !== -1) {
                            configData[weapons2Index]["needamount2 stars3"] = 100;
                            log.info(`✅ 已设置武器2材料需求量配置: 100`);
                        } else {
                            configData.push({ "needamount2 stars3": 100 });
                            log.info(`✅ 已添加武器2材料需求量配置: 100`);
                        }
                    }
                    
                    // 保存更新后的配置
                    file.writeTextSync(configPath, JSON.stringify(configData, null, 2));
                    log.info("✅ Wiki 材料数据已保存到配置文件");
                } else {
                    log.warn("⚠️ Wiki 数据获取失败，将使用现有配置继续运行");
                }
            } catch (wikiError) {
                // 检查是否是我们抛出的错误（角色/武器/材料不存在等）
                if (wikiError.message.includes("名字错误") || wikiError.message.includes("名称错误") || wikiError.message.includes("不存在") || wikiError.message.includes("获取失败")) {
                    log.error(`❌ ${wikiError.message}`);

                    // 显示错误弹窗并结束脚本
                    await showErrorModal({
                        title: 'Wiki数据获取失败',
                        message: wikiError.message,
                        timeout: 20
                    });

                    throw new Error(wikiError.message);
                }

                log.error(`❌ Wiki 数据获取出错: ${wikiError.message}`);
                log.info("将使用现有配置继续运行");
            }
        }
        
        // 封装从config.json读取配置的通用函数
        function getConfigValue(key) {
            try {
                const configContent = file.readTextSync(Constants.CONFIG_PATH);
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
        // 如果启用了 Wiki 数据获取，跳过角色识别流程
        if (settings.enableWikiDataFetch) {
            log.info("📌 启用了 Wiki 数据获取，跳过角色识别流程");
            log.info("📌 当前拥有材料默认为零");
            Overlay.updateStage('Wiki模式', '跳过角色识别，材料默认为零', 15);

            // Wiki模式下设置默认值
            try {
                const configContent = file.readTextSync(Constants.CONFIG_PATH);
                let configArray = JSON.parse(configContent);
                if (!Array.isArray(configArray)) {
                    configArray = [];
                }

                // 设置角色等级默认值为20
                const levelIndex = configArray.findIndex(item => item.hasOwnProperty("characterLevel"));
                if (levelIndex !== -1) {
                    configArray[levelIndex] = { "characterLevel": 20 };
                } else {
                    configArray.push({ "characterLevel": 20 });
                }

                // 设置角色突破状态默认值为"20级未突破"
                const breakIndex = configArray.findIndex(item => item.hasOwnProperty("characterBreak"));
                if (breakIndex !== -1) {
                    configArray[breakIndex] = { "characterBreak": "20级未突破" };
                } else {
                    configArray.push({ "characterBreak": "20级未突破" });
                }

                // 设置天赋等级默认值为"1-1-1"
                const talentIndex = configArray.findIndex(item => item.hasOwnProperty("talentLevels"));
                if (talentIndex !== -1) {
                    configArray[talentIndex] = { "talentLevels": "1-1-1" };
                } else {
                    configArray.push({ "talentLevels": "1-1-1" });
                }

                // 设置武器等级默认值为"20级未突破"
                const weaponLevelIndex = configArray.findIndex(item => item.hasOwnProperty("weaponLevel"));
                if (weaponLevelIndex !== -1) {
                    configArray[weaponLevelIndex] = { "weaponStar": configArray[weaponLevelIndex].weaponStar || "五星", "weaponLevel": "20级未突破" };
                } else {
                    configArray.push({ "weaponStar": "五星", "weaponLevel": "20级未突破" });
                }

                file.writeTextSync(Constants.CONFIG_PATH, JSON.stringify(configArray, null, 2));
                log.info(`✅ Wiki模式默认值已写入配置文件`);
            } catch (e) {
                log.warn(`写入Wiki模式默认值失败: ${e.message}`);
            }
        } else {
            log.info("📌 开始执行角色识别与材料计算流程...");
            Overlay.updateStage('角色识别与材料计算', '正在识别角色材料信息...', 10);
            const recognitionSuccess = await Character.findCharacterAndGetLevel();
            if (!recognitionSuccess) {
                log.error("❌ 角色识别失败，终止主流程");
                notification.error("角色识别失败，请检查角色是否正确配置");
                return;
            }
        }
        
        // ============== 材料刷取逻辑开始 ==============
        
        // 识别UID（用于区分不同账号的任务记录）并保存到配置
        const currentUid = await Collection.getCurrentAccountUid();
        const maskedUid = Utils.maskUid(currentUid);
        log.info(`📌 当前运行账号UID：${maskedUid}`);
        
        // 保存UID到配置文件（保持数组格式）
        try {
            const configContent = file.readTextSync(Constants.CONFIG_PATH);
            let configArray = JSON.parse(configContent);
            if (!Array.isArray(configArray)) {
                configArray = [];
            }
            const uidIndex = configArray.findIndex(item => item.hasOwnProperty("currentUid"));
            if (uidIndex !== -1) {
                configArray[uidIndex] = { "currentUid": currentUid };
            } else {
                configArray.push({ "currentUid": currentUid });
            }
            file.writeTextSync(Constants.CONFIG_PATH, JSON.stringify(configArray, null, 2));
            log.info(`✅ UID已保存到配置文件`);
        } catch (e) {
            log.warn(`保存UID到配置文件失败: ${e.message}`);
        }
        
        // ========== 全零检查与设置弹窗逻辑 ==========
        // 检查同一UID、同一角色的8个材料需求是否全为零
        const configForZeroCheck = Utils.readJson(Constants.CONFIG_PATH);
        const allZero = TaskManager.checkAllRequirementsZero(configForZeroCheck);
        
        if (allZero) {
            const currentCharacterNameForCheck = getStandardCharacterName(settings.Character) || (settings.Character ? settings.Character.trim() : "未知角色");
            log.info(`📌 角色【${currentCharacterNameForCheck}】的8个材料需求全为零`);
            
            // 检查3天例外：同一UID下是否有其他角色在3天内材料需求全为零
            // 如果有，说明可能是多角色共用材料导致数量误判为零，按原配置继续运行
            const hasOtherAllZero = TaskManager.hasOtherCharactersAllZeroWithin3Days(currentUid, currentCharacterNameForCheck);
            
            if (hasOtherAllZero) {
                log.info(`📌 检测到同一UID下有其他角色在3天内材料需求全为零，可能共用材料导致误判，按原配置继续运行`);
            } else {
                log.info(`📌 未检测到3天内的多角色共用材料情况，弹出设置弹窗供用户修改配置`);
                Overlay.updateStage('配置确认', '材料需求全为零，等待用户修改配置...', 15);
                
                const savedSettings = await showSettingsModal(settings, { showAllZeroHint: true });
                
                if (savedSettings) {
                    // 用户修改了配置，重新执行角色识别与材料计算流程
                    log.info(`📌 用户已修改配置，重新执行角色识别与材料计算流程`);
                    // 同步更新进度遮罩中显示的角色名称
                    const updatedCharacterName = getStandardCharacterName(settings.Character) || (settings.Character ? settings.Character.trim() : "未知角色");
                    Overlay.setCharacterName(updatedCharacterName);
                    Overlay.updateStage('角色识别与材料计算', '正在重新识别角色材料信息...', 10);
                    const reRecognitionSuccess = await Character.findCharacterAndGetLevel();
                    if (!reRecognitionSuccess) {
                        log.error("❌ 重新角色识别失败，终止主流程");
                        notification.error("重新角色识别失败，请检查角色是否正确配置");
                        return;
                    }
                } else {
                    // 超时未修改，结束运行
                    log.warn(`⚠️ 设置弹窗超时未修改，结束运行`);
                    notification.send("材料需求全为零且超时未修改配置，结束运行");
                    await genshin.returnMainUi();
                    return;
                }
            }
        }
        
        setGameMetrics(1920, 1080, 1);
        
        // 天赋书刷取逻辑
        Overlay.updateStage('天赋书刷取', '准备刷取天赋书...', 20);
        for (let i = 0; i < 1; i++) {
            const talentBookCandidates = [
                "自由",
                "抗争",
                "诗文",
                "繁荣",
                "勤劳",
                "黄金",
                "浮世",
                "风雅",
                "天光",
                "净言",
                "巧思",
                "笃行",
                "公平",
                "正义",
                "秩序",
                "角逐",
                "焚燔",
                "纷争",
                "月光",
                "乐园",
                "浪迹"
            ];
            const talentBookNameFromConfig = getConfigValue("talentDomainName");
            if (!talentBookNameFromConfig || talentBookNameFromConfig.trim() === "") {
                log.info(`天赋书配置为空，跳过执行`);
                continue;
            }
            const talentBookResult = Utils.fuzzyMatch(talentBookNameFromConfig, talentBookCandidates);
            const talentBookName = talentBookResult ? talentBookResult.match : null;
            if (talentBookName) {
                Overlay.updateStage('天赋书刷取', '刷取材料：' + talentBookName+  ' ❃获取中...', 25);
            }
            const currentCharacterName = getStandardCharacterName(settings.Character) || (settings.Character ? settings.Character.trim() : "未知角色");
            if (talentBookName && talentBookName !== "无") {
                try {
                    const talentBookConfigKey = `talentBookRequireCounts${i}`;
                    const talentBookCountsStr = getConfigValue(talentBookConfigKey);
                    let bookRequireCounts = Utils.parseAndValidateCounts(talentBookCountsStr, 3);
                    log.info(`天赋书${i + 1}方案解析成功: ${bookRequireCounts.join(', ')}`);
                    
                    const isCompleted = await TaskManager.isTaskCompleted("talent", talentBookName, bookRequireCounts, currentCharacterName, currentUid);
                    if (isCompleted) {
                        log.info(`天赋书${talentBookName} 已刷取至目标数量，跳过执行`);
                        Utils.addNotification(`天赋书${talentBookName} 已刷取至目标数量，跳过执行`);
                    } else {
                        await Farming.getTalentBook(talentBookName, bookRequireCounts, currentCharacterName, currentUid);
                    }
                } catch (error) {
                    notification.send(`天赋书${talentBookName}刷取失败，错误信息: ${error.message}`);
                }
            } else {
                if (!talentBookName) {
                    log.warn(`天赋书"${talentBookNameFromConfig}"模糊匹配失败，未找到匹配项，跳过执行`);
                } else {
                    log.info(`没有选择刷取天赋书${i + 1}，跳过执行`);
                }
            }
        }
        
        // 武器材料刷取逻辑
        Overlay.updateStage('武器材料刷取', '准备刷取武器材料...', 35);
        for (let i = 0; i < 1; i++) {
            const weaponDomainCandidates = [
                "高塔孤王",
                "凛风奔狼",
                "狮牙斗士",
                "孤云寒林",
                "雾海云间",
                "漆黑陨铁",
                "远海夷地",
                "鸣神御灵",
                "今昔剧话",
                "谧林涓露",
                "绿洲花园",
                "烈日威权",
                "幽谷弦音",
                "纯圣露滴",
                "无垢之海",
                "贡祭炽心",
                "谵妄圣主",
                "神合秘烟",
                "奇巧秘器",
                "长夜燧火",
                "终北遗嗣"
            ];
            const weaponDomainNameFromConfig = getConfigValue("weaponDomainName");
            if (!weaponDomainNameFromConfig || weaponDomainNameFromConfig.trim() === "") {
                log.info(`武器材料配置为空，跳过执行`);
                continue;
            }
            const weaponResult = Utils.fuzzyMatch(weaponDomainNameFromConfig, weaponDomainCandidates);
            const weaponName = weaponResult ? weaponResult.match : null;
            if (weaponName) {
                Overlay.updateStage('武器材料刷取', '刷取材料：' + weaponName+  '  ❃获取中...', 40);
            }
            const currentCharacterName = getStandardCharacterName(settings.Character) || (settings.Character ? settings.Character.trim() : "未知角色");
            if (weaponName && weaponName !== "无") {
                try {
                    const weaponConfigKey = `weaponMaterialRequireCounts${i}`;
                    const weaponCountsStr = getConfigValue(weaponConfigKey);
                    let weaponRequireCounts = Utils.parseAndValidateCounts(weaponCountsStr, 4);
                    log.info(`武器材料${i + 1}方案解析成功: ${weaponRequireCounts.join(', ')}`);
                    
                    const isCompleted = await TaskManager.isTaskCompleted("weapon", weaponName, weaponRequireCounts, currentCharacterName, currentUid);
                    if (isCompleted) {
                        log.info(`武器材料${weaponName} 已刷取至目标数量，跳过执行`);
                        Utils.addNotification(`武器材料${weaponName} 已刷取至目标数量，跳过执行`);
                    } else {
                        await Farming.getWeaponMaterial(weaponName, weaponRequireCounts, currentCharacterName, currentUid);
                    }
                } catch (error) {
                    notification.send(`武器材料${weaponName}刷取失败，错误信息: ${error.message}`);
                }
            } else {
                if (!weaponName) {
                    log.warn(`武器材料"${weaponDomainNameFromConfig}"模糊匹配失败，未找到匹配项，跳过执行`);
                } else {
                    log.info(`没有选择刷取武器材料${i + 1}，跳过执行`);
                }
            }
        }
        
        // 首领材料刷取逻辑
        Overlay.updateStage('首领材料刷取', '准备挑战首领...', 50);
        for (let i = 0; i < 1; i++) {
            const bossMaterialCandidates = [
                "蕴光月守宫",
                "爆炎树",
                "半永恒统辖矩阵",
                "掣电树",
                "纯水精灵",
                "翠翎恐蕈",
                "深罪浸礼者",
                "深邃摹结株",
                "风蚀沙虫",
                "「冰风组曲」歌裴莉娅",
                "「冰风组曲」科培琉司",
                "古岩龙蜥",
                "恒常机关阵列",
                "急冻树",
                "金焰绒翼龙暴君",
                "雷音权现",
                "灵觉隐修的迷者",
                "魔像督军",
                "秘源机兵·统御械",
                "秘源机兵·构型械",
                "魔偶剑鬼",
                "千年珍珠骏麟",
                "熔岩辉龙像",
                "贪食匿叶龙山王",
                "铁甲熔火帝皇",
                "无相之草",
                "无相之火",
                "无相之雷",
                "无相之水",
                "无相之岩",
                "水形幻人",
                "实验性场力发生装置",
                "遗迹巨蛇",
                "隐山猊兽",
                "兆载永劫龙兽",
                "重拳出击鸭",
                "蕴光月幻蝶",
                "霜夜巡天灵主",
                "超重型陆巡舰·机动战垒",
                "深黯魇语之主"
            ];
            const bossMaterialNameFromConfig = getConfigValue("bossMaterialName");
            if (!bossMaterialNameFromConfig || bossMaterialNameFromConfig.trim() === "") {
                log.info(`首领材料配置为空，跳过执行`);
                continue;
            }
            const bossResult = Utils.fuzzyMatch(bossMaterialNameFromConfig, bossMaterialCandidates);
            const bossName = bossResult ? bossResult.match : null;
            if (bossName) {
                Overlay.updateStage('首领材料刷取', '刷取材料：' + bossName + ' ❃获取中...', 50);
            }
            const currentCharacterName = getStandardCharacterName(settings.Character) || (settings.Character ? settings.Character.trim() : "未知角色");
            if (bossName && bossName !== "无") {
                try {
                    const bossConfigKey = `bossRequireCounts${i}`;
                    const bossRequireCounts = getConfigValue(bossConfigKey);
                    
                    const isCompleted = await TaskManager.isTaskCompleted("boss", bossName, bossRequireCounts, currentCharacterName, currentUid);
                    if (isCompleted) {
                        log.info(`首领材料${bossName} 已刷取至目标数量，跳过执行`);
                        Utils.addNotification(`首领材料${bossName} 已刷取至目标数量，跳过执行`);
                    } else {
                        await Farming.getBossMaterial(bossName, bossRequireCounts, currentCharacterName, currentUid);
                    }
                } catch (error) {
                    notification.send(`首领材料${bossName}刷取失败，错误信息: ${error.message}`);
                }
            } else {
                if (!bossName) {
                    log.warn(`首领材料"${bossMaterialNameFromConfig}"模糊匹配失败，未找到匹配项，跳过执行`);
                } else {
                    log.info(`没有选择挑战首领${i + 1}，跳过执行`);
                }
            }
        }
        
        Utils.sendBufferedNotifications();
        log.info("✅ 所有材料刷取逻辑执行完成");
        Overlay.updateStage('材料刷取完成', '准备进入材料采集阶段...', 55);

        // 返回游戏主界面
        log.info("📌 正在校准并返回游戏主界面...");
        await genshin.returnMainUi();
        await sleep(1500);
        
        // ============== 执行材料采集流程 ==========
        log.info("📌 开始执行材料采集流程...");
        Overlay.updateStage('材料采集', '准备执行材料采集...', 60);
        await runMaterialCollection();
        // 返回游戏主界面
        log.info("📌 正在校准并返回游戏主界面...");
        await genshin.returnMainUi();
        await sleep(1500);
        // ============== 最后一步：地脉花管理流程 ==========
        log.info("📌 开始执行地脉花管理流程...");
        Overlay.updateStage('地脉花管理', '准备执行地脉花任务...', 85);
        await runLeyLineManagement();
         // 返回游戏主界面
        log.info("📌 正在校准并返回游戏主界面...");
        await genshin.returnMainUi();
        await sleep(1500);
        
        // 完成所有任务
        Overlay.updateStage('全部完成！', '执行结束', 100);
        log.info("✅ 所有任务执行完成");
        await sleep(3000);
        
        // 关闭遮罩和清理资源
        Overlay.closeOverlay();
        Overlay.closeUidMask();
        Overlay.disposeKeyHook();
        
    } catch (globalError) {
        log.error(`❌ 整体流程执行失败: ${globalError.message}`);
        notification.send(`整体流程执行失败: ${globalError.message}`);
        
        // 确保在出错时也关闭遮罩
        try {
            Overlay.closeOverlay();
            Overlay.closeUidMask();
            Overlay.disposeKeyHook();
        } catch (e) {}
    }
};

// 材料采集主函数
async function runMaterialCollection() {
    log.info("===== BGI路径追踪脚本开始执行 =====");
    dispatcher.addTimer(new RealtimeTimer("AutoPick"));
    log.info("📌 正在返回游戏主界面并校准...");
    await genshin.returnMainUi();
    setGameMetrics(1920, 1080, 1.25);
    
    // 读取配置
    const config = Utils.readJson(Constants.CONFIG_PATH);
    const cooldownRecord = Utils.readJson(Constants.SCRIPT_COOLDOWN_RECORD, {});
    const isNoGrassGod = settings.isNoGrassGod || false;
    log.info(`📌 草神路线配置：${isNoGrassGod ? "排除有草神路线" : "默认选择有草神路线"}`);
    
    // 从配置读取UID（已在材料刷取流程中识别并保存）
    const currentUid = config["currentUid"] || Constants.DEFAULT_UID;
    const maskedUid = Utils.maskUid(currentUid);
    log.info(`📌 当前运行账号UID：${maskedUid}`);
    
    // 清理所有材料类型的过期冷却记录
    log.info("📌 正在清理过期冷却记录...");
    Collection.cleanExpiredCooldownRecords(cooldownRecord, currentUid);
    
    // 提取配置参数
    const localKeyword = config["LocalSpecialties"] || "";
    if (localKeyword) {
        Overlay.updateStage('地方特产采集', '采集材料：' + localKeyword + ' ❃准备采集中...', 60);
    }
    const allMagicKeywords = Collection.extractAllMagicKeywords(config);
    const allWeapons1Keywords = Collection.extractAllWeapons1Keywords(config);
    const allWeapons2Keywords = Collection.extractAllWeapons2Keywords(config);
    
    log.info(`读取到配置：`);
    log.info(`- 地方特产：关键词[${localKeyword}]`);
    log.info(`- 敌人与魔物：${allMagicKeywords.length}个关键词`);
    log.info(`- 武器1材料：${allWeapons1Keywords.length}个关键词`);
    log.info(`- 武器2材料：${allWeapons2Keywords.length}个关键词`);
    
    // 检查是否有需要执行的材料采集
    let hasAnyMaterialToCollect = false;
    let hasLocalToCollect = false;
    let hasMagicToCollect = false;
    let hasWeapons1ToCollect = false;
    let hasWeapons2ToCollect = false;
    
    // 队伍切换开关
    let hasSwitchedToLocalTeam = false;
    let hasSwitchedToCombatTeam = false;
    
    // 检查地方特产
    if (localKeyword && Number(config["needLocalAmount"]) > 0) {
        hasAnyMaterialToCollect = true;
        hasLocalToCollect = true;
    }
    
    // 检查敌人与魔物
    if (allMagicKeywords.length > 0 && Number(config["needMonsterStar3"]) > 0) {
        hasAnyMaterialToCollect = true;
        hasMagicToCollect = true;
    }
    
    // 检查武器1材料
    if (allWeapons1Keywords.length > 0 && Number(config["needamount1 stars3"]) > 0) {
        hasAnyMaterialToCollect = true;
        hasWeapons1ToCollect = true;
    }
    
    // 检查武器2材料
    if (allWeapons2Keywords.length > 0 && Number(config["needamount2 stars3"]) > 0) {
        hasAnyMaterialToCollect = true;
        hasWeapons2ToCollect = true;
    }
    
    // 只有在有需要执行的材料采集时，才前往指定地点并切换队伍
    if (hasAnyMaterialToCollect) {
        log.info("📌 正在前往指定地点...");
        await genshin.tp(2297.6201171875, -824.5869140625);
    } else {
        log.info("⚠️ 没有需要执行的材料采集，跳过前往指定地点和切换队伍");
    }
    
    try {
        // 1. 地方特产
        if (localKeyword) {
            if (hasLocalToCollect && !hasSwitchedToLocalTeam) {
                log.info("📌 切换到采集队伍...");
                await Utils.switchPartySafe(settings.teamName2);
                hasSwitchedToLocalTeam = true;
            }
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
            Utils.sendBufferedNotifications();
            await sleep(1000);
        }
        
        // 2. 敌人与魔物
        if (allMagicKeywords.length > 0) {
            if (hasMagicToCollect && !hasSwitchedToCombatTeam) {
                log.info("📌 切换到战斗队伍...");
                await Utils.switchPartySafe(settings.teamName);
                hasSwitchedToCombatTeam = true;
            }
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
            if (hasWeapons1ToCollect && !hasSwitchedToCombatTeam) {
                log.info("📌 切换到战斗队伍...");
                await Utils.switchPartySafe(settings.teamName);
                hasSwitchedToCombatTeam = true;
            }
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
            if (hasWeapons2ToCollect && !hasSwitchedToCombatTeam) {
                log.info("📌 切换到战斗队伍...");
                await Utils.switchPartySafe(settings.teamName);
                hasSwitchedToCombatTeam = true;
            }
            await executeMaterialCollection({
                type: 'weapons2',
                rootFolder: Constants.FOLDER_WEAPONS2,
                keywords: allWeapons2Keywords,
                configKey: 'needamount2 stars3',
                materialType: '武器2材料',
                currentUid,
                cooldownRecord
            });
            Utils.sendBufferedNotifications();
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
    // 如果启用了 Wiki 数据获取，使用默认需求量
    let currentAmount;
    if (settings.enableWikiDataFetch) {
        // Wiki 模式下使用默认需求量
        if (type === 'local') {
            currentAmount = 168; // 地方特产默认需求量
            log.info(`[${materialType}] Wiki 模式已启用，地方特产默认需求量为168`);
        } else if (type === 'magic') {
            currentAmount = 100; // 敌人与魔物默认需求量
            log.info(`[${materialType}] Wiki 模式已启用，敌人与魔物默认需求量为100`);
        } else if (type === 'boss') {
            currentAmount = 46; // Boss 材料默认需求量
            log.info(`[${materialType}] Wiki 模式已启用，Boss 材料默认需求量为46`);
        } else {
            currentAmount = 0;
            log.info(`[${materialType}] Wiki 模式已启用，材料数量默认为零`);
        }
    } else {
        const config = Utils.readJson(Constants.CONFIG_PATH);
        currentAmount = Number(config[configKey]) || 0;
    }
    
    if (currentAmount <= 0) {
        log.info(`[${materialType}] 需求数量为0，跳过执行`);
        Utils.addNotification(`[${materialType}] 需求数量为0，跳过执行`);
        
        // 需求为零时也保存到完成任务记录
        const currentCharacterName = getStandardCharacterName(settings.Character) || (settings.Character ? settings.Character.trim() : "未知角色");
        let taskMaterialType, taskMaterialName;
        if (type === 'local') {
            taskMaterialType = 'local';
            taskMaterialName = keywords;
        } else if (type === 'magic') {
            taskMaterialType = 'magic';
            taskMaterialName = Array.isArray(keywords) ? keywords.join(', ') : keywords;
        } else if (type === 'weapons1') {
            taskMaterialType = 'weapons1';
            taskMaterialName = Array.isArray(keywords) ? keywords.join(', ') : keywords;
        } else if (type === 'weapons2') {
            taskMaterialType = 'weapons2';
            taskMaterialName = Array.isArray(keywords) ? keywords.join(', ') : keywords;
        }
        if (taskMaterialType && taskMaterialName) {
            await TaskManager.addCompletedTask(taskMaterialType, taskMaterialName, 0, currentCharacterName, currentUid);
        }
        return false;
    }
    
    if (!keywords || (Array.isArray(keywords) && keywords.length === 0)) {
        log.info(`[${materialType}] 未配置关键词，跳过执行`);
        Utils.addNotification(`[${materialType}] 未配置关键词，跳过执行`);
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
        const basePath = "pathing";
        
        if (rootFolder === Constants.FOLDER_LOCAL) {
            const localRootDir = `${Constants.ASSETS_BASE}/${rootFolder}`.replace(/\\/g, "/");
            const relativeLocalRoot = localRootDir.startsWith(basePath + "/") ? localRootDir.substring(basePath.length + 1) : localRootDir;
            try {
                const regionDirs = Array.from(pathingScript.ReadPathSync(relativeLocalRoot) || []);
                for (const regionDir of regionDirs) {
                    const regionRelative = regionDir.replace(/\\/g, "/").replace(/^\/+/, "");
                    if (pathingScript.IsFolder(regionRelative)) {
                        const regionName = regionRelative.split(/[\\/]/).pop();
                        const targetRelative = `${relativeLocalRoot}/${regionName}/${keyword}`.replace(/\\/g, "/");
                        if (pathingScript.IsFolder(targetRelative)) {
                            const targetDir = `${localRootDir}/${regionName}/${keyword}`.replace(/\\/g, "/");
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
                const aliasRelative = `${rootFolder}/${alias}`.replace(/\\/g, "/").replace(/^\/+/, "");
                if (pathingScript.IsFolder(aliasRelative)) {
                    const aliasDir = `${Constants.ASSETS_BASE}/${rootFolder}/${alias}`.replace(/\\/g, "/");
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
        notification.send(`⚠️ 未找到${materialType}的JSON路径脚本`);
        log.warn("{0}", Constants.ERROR_NO_SCRIPTS);
        log.warn("{0}", Constants.ERROR_NO_PATHING);
        await sleep(15000);
        return false;
    }
    
    log.info(`✅ 共扫描到 ${allScriptFiles.length} 个路径脚本文件`);
    
    // 过滤掉异常路径
    const normalScripts = Collection.filterAbnormalPaths(allScriptFiles);
    
    // 过滤掉在冷却中的脚本
    const availableScripts = Collection.filterScriptsByCooldown(normalScripts, cooldown, cooldownRecord, currentUid);
    
    if (availableScripts.length === 0) {
        log.info(`[${materialType}] 所有脚本都在冷却中，跳过执行`);
        return false;
    }
    
    // 根据材料类型执行不同的控制逻辑
    let isCompleted = false;
    
    if (type === 'local') {
        isCompleted = await executeLocalBatch(availableScripts, isExcludeGrassGod, materialType, currentUid, cooldown, cooldownRecord, type);
    } else {
        isCompleted = await executeMonsterBatch(availableScripts, configKey, materialType, currentUid, cooldown, cooldownRecord, type);
    }
    
    // 采集完成后如果需求变为零，保存到完成任务记录
    if (isCompleted) {
        const newConfig = Utils.readJson(Constants.CONFIG_PATH);
        const newAmount = Number(newConfig[configKey]) || 0;
        if (newAmount <= 0) {
            const currentCharacterName = getStandardCharacterName(settings.Character) || (settings.Character ? settings.Character.trim() : "未知角色");
            let taskMaterialType, taskMaterialName;
            if (type === 'local') {
                taskMaterialType = 'local';
                taskMaterialName = keywords;
            } else if (type === 'magic') {
                taskMaterialType = 'magic';
                taskMaterialName = Array.isArray(keywords) ? keywords.join(', ') : keywords;
            } else if (type === 'weapons1') {
                taskMaterialType = 'weapons1';
                taskMaterialName = Array.isArray(keywords) ? keywords.join(', ') : keywords;
            } else if (type === 'weapons2') {
                taskMaterialType = 'weapons2';
                taskMaterialName = Array.isArray(keywords) ? keywords.join(', ') : keywords;
            }
            if (taskMaterialType && taskMaterialName) {
                await TaskManager.addCompletedTask(taskMaterialType, taskMaterialName, 0, currentCharacterName, currentUid);
            }
        }
    }
    
    return isCompleted;
}

// 地方特产分批执行逻辑
async function executeLocalBatch(allScripts, isExcludeGrassGod, materialType, currentUid, cooldown, cooldownRecord, type) {
    let remainingScripts = [...allScripts];
    let isCompleted = false;
    
    const startIndex = Collection.getStartIndex(remainingScripts, currentUid, cooldownRecord, type);
    remainingScripts = remainingScripts.slice(startIndex);
    
    if (startIndex > 0) {
        log.info(`📌 [${materialType}] 断点续传，从第${startIndex + 1}个脚本开始执行`);
    }
    
    while (remainingScripts.length > 0) {
        const config = Utils.readJson(Constants.CONFIG_PATH);
        const currentNeed = Number(config["needLocalAmount"]) || 0;
        
        log.info(`\n📊 [${materialType}] 当前需求量：${currentNeed}，剩余脚本数：${remainingScripts.length}`);
        
        if (currentNeed <= 0) {
            log.info(`✅ [${materialType}] 需求已满足，停止执行`);
            Utils.addNotification(`✅ [${materialType}] 需求已满足，停止执行`);
            isCompleted = true;
            break;
        }
        
        const scriptsToExecute = Collection.filterLocalScriptsByCount(remainingScripts, currentNeed, !isExcludeGrassGod);
        
        if (scriptsToExecute.length === 0) {
            log.info(`⚠️ [${materialType}] 无需要执行的脚本`);
            Utils.addNotification(`⚠️ [${materialType}] 无需要执行的脚本`);
            break;
        }
        
        const totalCanGet = scriptsToExecute.reduce((sum, s) => sum + (s.count || Constants.DEFAULT_LOCAL_COUNT), 0);
        log.info(`🔢 [${materialType}] 本次计划执行${scriptsToExecute.length}个脚本，预计获取${totalCanGet}个特产`);
        
        const result = await Collection.executeScripts(scriptsToExecute, 0, 0, currentUid, cooldown, cooldownRecord,
            function(script, current, total) {
                const keyword = Utils.readJson(Constants.CONFIG_PATH)["LocalSpecialties"] || "";
                Overlay.updateStatus(
                    '采集进度[' + current + '/' + total + ']  预计获取' + totalCanGet + '个特产  采集中...',
                    '采集材料： ' + keyword + '   ▶   ' + script.name
                );
            }
        );
        
        const executedPaths = new Set(scriptsToExecute.slice(0, result.executedCount).map(s => s.path));
        remainingScripts = remainingScripts.filter(s => !executedPaths.has(s.path));
        
        if (totalCanGet >= currentNeed) {
            log.info(`📌 [${materialType}] 本次执行路径数量(${totalCanGet}) >= 需求量(${currentNeed})，触发角色识别`);
            const recognitionType = materialType === '地方特产' ? 'break' : 'all';
            await performCharacterRecognition(materialType, recognitionType);
            
            const newConfig = Utils.readJson(Constants.CONFIG_PATH);
            const newNeed = Number(newConfig["needLocalAmount"]) || 0;
            
            if (newNeed <= 0) {
                log.info(`✅ [${materialType}] 需求已满足，停止执行`);
                Utils.addNotification(`✅ [${materialType}] 需求已满足，停止执行`);
                isCompleted = true;
                break;
            }
        } else {
            log.info(`ℹ️ [${materialType}] 本次执行路径数量(${totalCanGet}) < 需求量(${currentNeed})，不触发角色识别`);
        }
        
        if (remainingScripts.length === 0) {
            log.info(`✅ [${materialType}] 所有路径已执行完毕`);
            Utils.addNotification(`✅ [${materialType}] 所有路径已执行完毕`);
            isCompleted = true;
        }
        
        await sleep(1000);
    }
    
    return isCompleted;
}

// 敌人与魔物/武器材料分批执行逻辑（阈值控制）
async function executeMonsterBatch(allScripts, configKey, materialType, currentUid, cooldown, cooldownRecord, type) {
    let remainingScripts = [...allScripts];
    let isCompleted = false;

    const startIndex = Collection.getStartIndex(remainingScripts, currentUid, cooldownRecord, type);
    remainingScripts = remainingScripts.slice(startIndex);

    if (startIndex > 0) {
        log.info(`📌 [${materialType}] 断点续传，从第${startIndex + 1}个脚本开始执行`);
    }

    Overlay.updateStage(materialType, '准备收集...', 60);

    while (remainingScripts.length > 0) {
        // 如果启用了 Wiki 数据获取，使用默认需求量
        let currentAmount;
        if (settings.enableWikiDataFetch) {
            // Wiki 模式下使用默认需求量
            if (type === 'local') {
                currentAmount = 168; // 地方特产默认需求量
            } else if (type === 'magic') {
                currentAmount = 100; // 敌人与魔物默认需求量
            } else if (type === 'boss') {
                currentAmount = 46; // Boss 材料默认需求量
            } else {
                currentAmount = 0;
            }
        } else {
            const config = Utils.readJson(Constants.CONFIG_PATH);
            currentAmount = Number(config[configKey]) || 0;
        }
        
        log.info(`\n📊 [${materialType}] 当前材料需求量：${currentAmount}，剩余脚本数：${remainingScripts.length}`);
        
        if (currentAmount <= 0) {
            log.info(`✅ [${materialType}] 材料需求已满足，停止执行`);
            Utils.addNotification(`✅ [${materialType}] 材料需求已满足，停止执行`);
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
        
        const result = await Collection.executeScripts(remainingScripts, 0, batchSize, currentUid, cooldown, cooldownRecord,
            function(script, current, total) {
                Overlay.updateStatus(
                    '当前进度[' + current + '/' + total + '] 当前材料需求量' + currentAmount + '个  收集中...',
                    materialType + '   ▶   ' + script.name
                );
            }
        );
        remainingScripts = result.remainingScripts;
        
        if (remainingScripts.length === 0) {
            log.info(`✅ [${materialType}] 所有路径已执行完毕`);
            Utils.addNotification(`✅ [${materialType}] 所有路径已执行完毕`);
            isCompleted = true;
            break;
        }
        
        if (shouldTriggerRecognition) {
            let recognitionType = 'all';
            if (type === 'magic') {
                recognitionType = 'break';
            } else if (type === 'weapons1' || type === 'weapons2') {
                recognitionType = 'weapon';
            }
            await performCharacterRecognition(materialType, recognitionType);
            const newConfig = Utils.readJson(Constants.CONFIG_PATH);
            const newAmount = Number(newConfig[configKey]) || 0;
            
            log.info(`📊 [${materialType}] 角色识别后材料需求量：${newAmount}`);
            
            if (newAmount <= 0) {
                log.info(`✅ [${materialType}] 材料需求已满足，停止执行剩余路径`);
                Utils.addNotification(`✅ [${materialType}] 材料需求已满足，停止执行剩余路径`);
                isCompleted = true;
                break;
            }
        }
        
        await sleep(1000);
    }
    
    return isCompleted;
}

// 执行角色识别
async function performCharacterRecognition(materialType, recognitionType = "all") {
    log.info(`📌 开始执行${materialType}的角色识别与材料计算流程（识别类型：${recognitionType}）...`);
    
    // Wiki 模式启用时跳过角色识别
    if (settings.enableWikiDataFetch) {
        log.info(`[${materialType}] Wiki 模式已启用，跳过角色识别流程`);
        return;
    }
    
    try {
        await Character.findCharacterAndGetLevel(recognitionType);
        log.info(`✅ ${materialType}角色识别与材料更新完成`);
        await sleep(2000);
    } catch (e) {
        log.error(`❌ ${materialType}角色识别失败：${e.message}`);
    }
}

// 地脉花管理流程
async function runLeyLineManagement() {
    try {
        log.info("===== 地脉花管理流程开始执行 =====");
        setGameMetrics(1920, 1080, 1)
        // 检查体力值
        const stamina = await Inventory.queryStaminaValue();
        const minStamina = 20;
        
        if (stamina < minStamina) {
            log.warn(`体力不足！当前体力：${stamina}，需要：${minStamina}`);
            log.info("体力不足，跳过地脉花流程");
            notification.send("体力不足，跳过地脉花流程");
            return;
        }
        
        log.info(`体力充足：${stamina}，开始地脉花`);
        
        // 初始化地脉花次数
        let expRuns = 0;
        let moraRuns = 0;
        
        // 读取并验证设置
        const { 
            targetRoleLevel, 
            targetBreakLevel,
            characterLevel, 
            characterBreak,
            talentLevels,
            targetTalentLevels,
            weaponStar,
            weaponLevel,
            weaponBreakLevel,
            targetWeaponLevel,
            targetWeaponBreakLevel,
            moraAmount
        } = readAndValidateSettingsForLeyLine();

        // 检查是否已经是满级
        if (targetRoleLevel >= 90 && characterLevel >= 90) {
            log.info(`角色已是满级（${characterLevel}级），无需经验书`);
            expRuns = 0;
        }

        // 获取世界等级（摩拉计算需要）
        const worldLevel = await getWorldLevelForLeyLine();

        // 只有不满级时才获取经验书数据
        let expBookData = { totalBookExperience: 0 };
        if (!(targetRoleLevel >= 90 && characterLevel >= 90)) {
            expBookData = await getExperienceBookDataForLeyLine();
        }

        // 计算升级所需经验
        const requiredExp = expCalculator.calculateExpRequired(characterLevel, 0, targetRoleLevel);
        log.info(`从${characterLevel}级升级到${targetRoleLevel}级需要${requiredExp}经验`);

        // 初始化经验书需求
        let bookRequirements = {
            purple: 0,
            blue: 0,
            green: 0,
            summary: "无需经验书"
        };

        // 如果已经是满级或不需要经验，跳过经验书相关计算
        if (requiredExp <= 0) {
            log.info(`无需经验书，跳过经验书地脉花任务`);
            expRuns = 0;
        } else {
            // 转换为经验书数量
            bookRequirements = expCalculator.convertExpToBooks(requiredExp);
            log.info(bookRequirements.summary);

            // 计算经验书地脉花次数
            const totalBookExperience = expBookData.totalBookExperience;
            log.info(`当前库存经验书总经验: ${totalBookExperience}`);
            const expShortage = Math.max(0, requiredExp - totalBookExperience);
            log.info(`经验缺口计算: ${requiredExp} - ${totalBookExperience} = ${expShortage}`);
            if (expShortage > 0) {
                const resinRequirements = resinCalculation.calculateExpBookRequirements(expShortage, worldLevel);
                expRuns = resinRequirements.runs.totalChallenges;
                log.info(`经验缺口: ${expShortage}, 经验书地脉花次数: ${expRuns}`);
            } else {
                log.info(`经验书充足，无需执行经验书地脉花任务`);
                Utils.addNotification(`经验书充足，无需执行经验书地脉花任务`);
            }
        }

        // 计算摩拉需求
        const moraConfig = {
            characterLevel: characterLevel,
            characterBreak: characterBreak,
            targetRoleLevel: targetRoleLevel,
            targetBreakLevel: targetBreakLevel,
            talentLevels: talentLevels,
            targetTalentLevels: targetTalentLevels,
            weaponStar: weaponStar,
            weaponLevel: weaponLevel,
            weaponBreakLevel: weaponBreakLevel,
            targetWeaponLevel: targetWeaponLevel,
            targetWeaponBreakLevel: targetWeaponBreakLevel,
            bookRequirements: bookRequirements,
            currentMora: moraAmount
        };
        
        const moraResult = moraCalculation.calculateTotalMoraRequirement(moraConfig);
        log.info(`摩拉计算结果: ${JSON.stringify(moraResult, null, 2)}`);

        // 计算摩拉缺口和地脉花次数
        let moraShortage = 0;
        if (moraResult.remainingMora < 0) {
            moraShortage = -moraResult.remainingMora;
            log.info(`摩拉缺口: ${moraShortage}`);
            const moraLeyLineResult = resinCalculation.calculateMoraLeyLineRuns(moraShortage, worldLevel);
            moraRuns = moraLeyLineResult.totalRuns;
            log.info(`摩拉地脉花次数: ${moraRuns}, 每次摩拉掉落: ${moraLeyLineResult.moraPerRun}`);
        }

        // 保存经验书/摩拉地脉花的零需求任务记录
        const leyLineConfig = Utils.readJson(Constants.CONFIG_PATH);
        const leyLineUid = leyLineConfig["currentUid"] || Constants.DEFAULT_UID;
        const leyLineCharacterName = getStandardCharacterName(settings.Character) || (settings.Character ? settings.Character.trim() : "未知角色");
        if (expRuns <= 0) {
            log.info(`经验书地脉花需求为零，保存到完成任务记录`);
            await TaskManager.addCompletedTask("exp", "经验书地脉花", 0, leyLineCharacterName, leyLineUid);
        }
        if (moraRuns <= 0) {
            log.info(`摩拉地脉花需求为零，保存到完成任务记录`);
            await TaskManager.addCompletedTask("mora", "摩拉地脉花", 0, leyLineCharacterName, leyLineUid);
        }

        // 执行地脉花任务
        if (expRuns > 0 || moraRuns > 0) {
            await runAutoLeyLineOutcropTask(expRuns, moraRuns, stamina);
        } else {
            log.info("经验书和摩拉都已充足，无需执行地脉花任务");
            notification.send("经验书和摩拉都已充足，无需执行地脉花任务");
        }

        await genshin.returnMainUi();
        log.info("✅ 地脉花管理流程执行完成");

    } catch (error) {
        log.error(`地脉花管理流程执行失败: ${error.message}`);
        log.error(`错误堆栈: ${error.stack}`);
        notification.send(`地脉花管理流程执行失败: ${error.message}`);

        try {
            await genshin.returnMainUi();
        } catch (uiError) {
            log.warn(`返回主界面失败: ${uiError.message}`);
        }
    }
    
    log.info("===== 地脉花管理流程执行结束 =====");
}

// 读取并验证配置（地脉花管理专用）
function readAndValidateSettingsForLeyLine() {
    const bossRequireCounts = settings.bossRequireCounts;

    const levelMapping = {
        "20级": { level: 40, break: 40 },
        "40级": { level: 50, break: 50 },
        "50级": { level: 60, break: 60 },
        "60级": { level: 70, break: 70 },
        "70级": { level: 80, break: 80 },
        "80级": { level: 90, break: 90 }
    };

    const targetLevelInfo = levelMapping[bossRequireCounts];
    if (!targetLevelInfo) {
        throw new Error("非法输入或未输入目标角色等级，请选择有效的等级");
    }
    const targetRoleLevel = targetLevelInfo.level;
    const targetBreakLevel = targetLevelInfo.break;

    const weaponLevelMapping = {
        "20级": { level: 20, break: 20 },
        "40级": { level: 40, break: 40 },
        "50级": { level: 50, break: 50 },
        "60级": { level: 60, break: 60 },
        "70级": { level: 70, break: 70 },
        "80级": { level: 80, break: 80 }
    };
    const weaponRequireCounts = settings.weaponMaterialRequireCounts;
    const targetWeaponInfo = weaponLevelMapping[weaponRequireCounts] || { level: 80, break: 5 };
    const targetWeaponLevel = targetWeaponInfo.level;
    const targetWeaponBreakLevel = targetWeaponInfo.break;

    let characterLevel = 0;
    let characterBreak = 0;
    let talentLevels = [1, 1, 1];
    let weaponStar = "四星";
    let weaponLevel = 1;
    let weaponBreakLevel = 0;
    let moraAmount = 0;

    try {
        const configContent = file.readTextSync(Constants.CONFIG_PATH);
        const configArray = JSON.parse(configContent);

        const levelConfig = configArray.find(item => item.characterLevel !== undefined);
        if (levelConfig) {
            characterLevel = Number(levelConfig.characterLevel);
        }

        const breakConfig = configArray.find(item => item.characterBreak !== undefined);
        if (breakConfig) {
            const breakStr = breakConfig.characterBreak;
            const match = breakStr.match(/(\d+)级/);
            if (match) {
                const breakLevel = parseInt(match[1]);
                characterBreak = breakStr.includes("已突破") ? 90 : breakLevel;
            }
        }

        const talentConfig = configArray.find(item => item.talentLevels !== undefined);
        if (talentConfig) {
            const talents = talentConfig.talentLevels.split('-').map(Number);
            talentLevels = talents;
        }

        const weaponStarConfig = configArray.find(item => item.weaponStar !== undefined);
        if (weaponStarConfig) {
            weaponStar = weaponStarConfig.weaponStar;
        }

        const weaponLevelConfig = configArray.find(item => item.weaponLevel !== undefined);
        if (weaponLevelConfig) {
            const levelStr = weaponLevelConfig.weaponLevel;
            const match = levelStr.match(/(\d+)级/);
            if (match) {
                weaponLevel = parseInt(match[1]);
                weaponBreakLevel = levelStr.includes("已突破") ? 90 : weaponLevel;
            }
        }

        const moraConfig = configArray.find(item => item.moraAmount !== undefined);
        if (moraConfig) {
            moraAmount = Number(moraConfig.moraAmount);
        }
    } catch (error) {
        log.error(`读取config.json失败: ${error.message}`);
        throw new Error("读取config.json失败");
    }

    if (isNaN(characterLevel) || characterLevel <= 0 || characterLevel > 90) {
        throw new Error("config.json中的characterLevel配置无效，请输入1-90之间的有效数字");
    }

    const talentRequireCounts = settings.talentBookRequireCounts;
    const targetTalentLevels = talentRequireCounts ? talentRequireCounts.split('-').map(Number) : [10, 10, 10];
    
    return { 
        targetRoleLevel, 
        targetBreakLevel,
        characterLevel, 
        characterBreak,
        talentLevels,
        targetTalentLevels,
        weaponStar,
        weaponLevel,
        weaponBreakLevel,
        targetWeaponLevel,
        targetWeaponBreakLevel,
        moraAmount
    };
}

// 获取经验书数据（地脉花管理专用）
async function getExperienceBookDataForLeyLine() {
    try {
        const expBookInfo = await ImageRecognition.IdentifyExperienceBook();
        if (!expBookInfo) {
            return { totalBookExperience: 0 };
        }
        const bookData = FileUtils.getExpBookData(expBookInfo, true);
        if (bookData && bookData.length > 0) {
            const totalItem = bookData.find(item => item.bookName === '总计');
            return { totalBookExperience: totalItem ? totalItem.totalExp : 0 };
        }
        return { totalBookExperience: 0 };
    } catch (error) {
        log.warn(`识别经验书失败: ${error.message}`);
        return { totalBookExperience: 0 };
    }
}

// 获取世界等级（地脉花管理专用）
async function getWorldLevelForLeyLine() {
    try {
        const worldLevel = await ImageRecognition.WorldLevelRecognition();
        if (!worldLevel) {
            log.warn("世界等级识别失败，使用默认值0");
            return 0;
        }
        return worldLevel;
    } catch (error) {
        log.error(`获取世界等级失败: ${error.message}`);
        log.warn("使用默认世界等级0");
        return 0;
    }
}

// 执行地脉花任务
async function runAutoLeyLineOutcropTask(expRuns, moraRuns, stamina) {
    try {
        if (moraRuns > 0) {
            const moraMaxRounds = moraRuns >= 5 ? 2 : 1;
            for (let i = 0; i < moraMaxRounds; i++) {
                log.info(`开始执行藏金之花，次数: ${moraRuns}, 第${i + 1}轮`);
                
                // 检查体力值
             const stamina = await Inventory.queryStaminaValue();
             const minStamina = 20;
              if (stamina < minStamina) {
            log.warn(`体力值${stamina}低于${minStamina}，跳过当前轮`);
            continue;
        }
                
                const resin = await Inventory.queryStaminaValue();
                const resinSupportedCount = Math.floor(resin / 40) + (resin % 40 >= 20 ? 1 : 0);
                const actualCount = Math.min(moraRuns, resinSupportedCount);
                log.info(`当前树脂: ${resin}, 树脂支持次数: ${resinSupportedCount}, 实际执行次数: ${actualCount}`);
                notification.send(`当前树脂: ${resin}, 树脂支持次数: ${resinSupportedCount}, 实际执行次数: ${actualCount}`);
                Overlay.updateStage('共进行（' + actualCount + '轮）正在刷取摩拉', 85);
                
                let taskParam = new AutoLeyLineOutcropParam();
                taskParam.Count = actualCount;
                taskParam.Country = settings.adventurePath || "蒙德";
                taskParam.LeyLineOutcropType = "藏金之花";
                taskParam.Team = settings.teamName || "";
                taskParam.IsResinExhaustionMode = false;
                taskParam.UseAdventurerHandbook = false;
                taskParam.IsGoToSynthesizer = false;
                taskParam.UseFragileResin = false;
                taskParam.UseTransientResin = false;
                taskParam.IsNotification = false;
                taskParam.FightConfig.StrategyName = settings.strategyName || "auto";
                await dispatcher.RunAutoLeyLineOutcropTask(taskParam);
                log.info("藏金之花完成");
            }
        }

        if (expRuns > 0) {
            const expMaxRounds = expRuns >= 5 ? 2 : 1;
            for (let i = 0; i < expMaxRounds; i++) {
                log.info(`开始执行启示之花，次数: ${expRuns}, 第${i + 1}轮`);
                
                let currentStamina = stamina;
                if (i > 0) {
                    currentStamina = await Inventory.queryStaminaValue();
                }
                
                const resinSupportedCount = Math.floor(currentStamina / 40) + (currentStamina % 40 >= 20 ? 1 : 0);
                const actualCount = Math.min(expRuns, resinSupportedCount);
                log.info(`当前树脂: ${currentStamina}, 树脂支持次数: ${resinSupportedCount}, 实际执行次数: ${actualCount}`);
                notification.send(`当前树脂: ${currentStamina}, 树脂支持次数: ${resinSupportedCount}, 实际执行次数: ${actualCount}`);
                Overlay.updateStage('共进行（' + actualCount + '轮）正在刷取经验书', 90);
                let taskParam = new AutoLeyLineOutcropParam();
                taskParam.Count = actualCount;
                taskParam.Country = settings.adventurePath || "蒙德";
                taskParam.LeyLineOutcropType = "启示之花";
                taskParam.Team = settings.teamName || "";
                taskParam.IsResinExhaustionMode = false;
                taskParam.UseAdventurerHandbook = false;
                taskParam.IsGoToSynthesizer = false;
                taskParam.UseFragileResin = false;
                taskParam.UseTransientResin = false;
                taskParam.IsNotification = false;
                taskParam.FightConfig.StrategyName = settings.strategyName || "auto";
                await dispatcher.RunAutoLeyLineOutcropTask(taskParam);
                log.info("启示之花完成");
            }
        }

        log.info("自动地脉花完成");
        notification.send("自动地脉花完成");
    } catch (error) {
        log.error(`执行地脉花任务失败：${error.message}`);
        if (error.message !== "树脂耗尽，任务结束") {
            throw error;
        }
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
    
    // 定义清理函数，确保资源释放
    function cleanupResources() {
        try {
            Overlay.closeOverlay();
        } catch (e) {}
        try {
            Overlay.closeUidMask();
        } catch (e) {}
        try {
            Overlay.disposeKeyHook();
        } catch (e) {}
    }
    
    try {
        await Main();
    } catch (err) {
        // 捕获任何错误（包括手动取消任务）
        if (err.message && (err.message.includes("A task was canceled") || err.message.includes("取消自动任务"))) {
            log.info("[脚本终止] 检测到手动取消任务，正在清理资源...");
        } else {
            log.error(`[脚本异常] 执行错误：${err.message}`);
        }
    } finally {
        // 无论正常结束还是异常退出，都确保清理资源
        cleanupResources();
        __genshinMaterialScriptExecuting = false;
    }
})();

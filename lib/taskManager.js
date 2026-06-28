// 任务管理模块
var TaskManager = {
    // 加载已完成任务记录
    loadCompletedTasks: function() {
        return Utils.readJson(Constants.COMPLETED_TASKS_FILE, {});
    },
    
    // 保存已完成任务记录
    saveCompletedTasks: async function(tasks) {
        try {
            await file.writeText(Constants.COMPLETED_TASKS_FILE, JSON.stringify(tasks, null, 2));
            log.info("已保存完成任务记录");
        } catch (error) {
            log.error(`保存任务记录失败: ${error}`);
        }
    },
    
    // 添加已完成任务
    addCompletedTask: async function(materialType, materialName, requireCounts, characterName, uid) {
        const tasks = this.loadCompletedTasks();
        const taskKey = `${uid}_${characterName}_${materialType}_${materialName}`;
        
        tasks[taskKey] = {
            uid,
            characterName,
            materialType,
            materialName,
            requireCounts,
            completedAt: new Date().toISOString()
        };
        
        await this.saveCompletedTasks(tasks);
        log.info(`已标记 ${uid} 的 ${characterName} 的 ${materialName} 为完成`);
    },
    
    isTaskCompleted: async function(materialType, materialName, currentRequireCounts, characterName, uid) {
        const tasks = this.loadCompletedTasks();
        const taskKey = `${uid}_${characterName}_${materialType}_${materialName}`;
        
        if (!tasks[taskKey]) {
            return false;
        }
        
        const previousRequireCounts = tasks[taskKey].requireCounts;
        if (Array.isArray(previousRequireCounts) && Array.isArray(currentRequireCounts)) {
            return previousRequireCounts.join(',') === currentRequireCounts.join(',');
        } else {
            return previousRequireCounts === currentRequireCounts;
        }
    },

    hasCompletedTaskRecord: function(materialType, materialName, characterName, uid) {
        const tasks = this.loadCompletedTasks();
        const taskKey = `${uid}_${characterName}_${materialType}_${materialName}`;
        return !!tasks[taskKey];
    },
    
    // 检查所有材料需求是否全为零（8项：天赋书、武器秘境、首领、地方特产、敌人魔物、武器1、武器2、经验书/摩拉）
    // 前7项从config检查，第8项（经验书/摩拉）在前7项全为零时必然为零（角色已满级无需升级）
    checkAllRequirementsZero: function(config) {
        // 1. 天赋书
        const talentCounts = config["talentBookRequireCounts0"];
        if (talentCounts === undefined || talentCounts === null) return false;
        const talentArr = typeof talentCounts === 'string' ? talentCounts.split('-').map(Number) : (Array.isArray(talentCounts) ? talentCounts : []);
        if (talentArr.length === 0 || !talentArr.every(c => c === 0)) return false;
        
        // 2. 武器秘境材料
        const weaponCounts = config["weaponMaterialRequireCounts0"];
        if (weaponCounts === undefined || weaponCounts === null) return false;
        const weaponArr = typeof weaponCounts === 'string' ? weaponCounts.split('-').map(Number) : (Array.isArray(weaponCounts) ? weaponCounts : []);
        if (weaponArr.length === 0 || !weaponArr.every(c => c === 0)) return false;
        
        // 3. 首领材料
        if (Number(config["bossRequireCounts0"]) !== 0) return false;
        
        // 4. 地方特产
        if (Number(config["needLocalAmount"]) !== 0) return false;
        
        // 5. 敌人与魔物
        if (Number(config["needMonsterStar3"]) !== 0) return false;
        
        // 6. 武器1材料
        if (Number(config["needamount1 stars3"]) !== 0) return false;
        
        // 7. 武器2材料
        if (Number(config["needamount2 stars3"]) !== 0) return false;
        
        // 8. 经验书/摩拉地脉花 - 前7项全为零意味着角色已满级、天赋已满、武器已满，经验书和摩拉需求必然为零
        return true;
    },
    
    // 检查同一UID是否有其他角色在3天内材料需求全为零
    // 用于处理多角色共用材料导致数量误判为零的情况
    hasOtherCharactersAllZeroWithin3Days: function(uid, currentCharacterName) {
        const tasks = this.loadCompletedTasks();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        const now = new Date().getTime();
        
        // 收集同一UID下所有不同的角色名称（排除当前角色）
        const characterNames = new Set();
        for (const key in tasks) {
            const task = tasks[key];
            if (task.uid === uid && task.characterName !== currentCharacterName) {
                characterNames.add(task.characterName);
            }
        }
        
        for (const charName of characterNames) {
            // 收集该角色的所有任务
            const charTasks = [];
            for (const key in tasks) {
                const task = tasks[key];
                if (task.uid === uid && task.characterName === charName) {
                    charTasks.push(task);
                }
            }
            
            // 检查是否有在3天内的记录
            const hasRecentTask = charTasks.some(task => {
                const completedAt = new Date(task.completedAt).getTime();
                return (now - completedAt) <= threeDaysMs;
            });
            
            if (!hasRecentTask) continue;
            
            // 检查该角色是否有所有核心材料类型的记录且全为零
            const materialTypes = new Set(charTasks.map(t => t.materialType));
            const coreTypes = ['talent', 'weapon', 'boss', 'local', 'magic', 'weapons1', 'weapons2'];
            const hasAllCoreTypes = coreTypes.every(type => materialTypes.has(type));
            
            if (hasAllCoreTypes) {
                // 检查所有记录的requireCounts是否都为零
                const allZero = charTasks.every(task => {
                    if (Array.isArray(task.requireCounts)) {
                        return task.requireCounts.every(c => c === 0);
                    } else {
                        return task.requireCounts === 0;
                    }
                });
                
                if (allZero) {
                    log.info(`📌 检测到同一UID下角色【${charName}】在3天内材料需求全为零，可能共用材料`);
                    return true;
                }
            }
        }
        
        return false;
    }
};

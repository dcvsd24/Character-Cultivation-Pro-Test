// 任务管理模块
var TaskManager = {
    // 加载已完成任务记录
    loadCompletedTasks: async function() {
        try {
            if (file.isFolder(Constants.COMPLETED_TASKS_FILE)) {
                return {};
            }
            const content = await file.readText(Constants.COMPLETED_TASKS_FILE);
            return JSON.parse(content);
        } catch (error) {
            return {};
        }
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
    addCompletedTask: async function(materialType, materialName, requireCounts) {
        const tasks = await this.loadCompletedTasks();
        const taskKey = `${materialType}_${materialName}`;
        
        tasks[taskKey] = {
            materialType,
            materialName,
            requireCounts,
            completedAt: new Date().toISOString()
        };
        
        await this.saveCompletedTasks(tasks);
        log.info(`已标记 ${materialName} 为完成`);
    },
    
    // 检查任务是否已完成
    isTaskCompleted: async function(materialType, materialName, currentRequireCounts) {
        const tasks = await this.loadCompletedTasks();
        const taskKey = `${materialType}_${materialName}`;
        
        if (!tasks[taskKey]) {
            return false;
        }
        
        const previousRequireCounts = tasks[taskKey].requireCounts;
        if (Array.isArray(previousRequireCounts) && Array.isArray(currentRequireCounts)) {
            return previousRequireCounts.join(',') === currentRequireCounts.join(',');
        } else {
            return previousRequireCounts === currentRequireCounts;
        }
    }
};

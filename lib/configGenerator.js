// Generates data/run_data/config.json from data/user_settings.json for the planner workflow.
var ConfigGenerator = {
    readUserSettings: function() {
        return Utils.readJson("data/user_settings.json", {});
    },

    readConfigArray: function() {
        try {
            const raw = file.readTextSync(Constants.CONFIG_PATH);
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    },

    updateConfigObject: function(configArray, obj) {
        for (const key of Object.keys(obj)) {
            const index = configArray.findIndex(item => item && Object.prototype.hasOwnProperty.call(item, key));
            if (index !== -1) {
                configArray[index][key] = obj[key];
            } else {
                configArray.push({ [key]: obj[key] });
            }
        }
    },

    mergeConfigGroups: function(configArray) {
        const groups = [
            ["LocalSpecialties", "needLocalAmount", "needMonsterStar3", "Magic material0", "talentMobMaterialNameRaw"],
            ["bossMaterialNameRaw", "bossMaterialName", "bossRequireCounts0"],
            ["talentDomainName", "talentBookRequireCounts0"],
            ["weaponDomainName", "weaponMaterialRequireCounts0"],
            ["Weapons1 material0", "needamount1 stars3"],
            ["Weapons2 material0", "needamount2 stars3"]
        ];

        for (const groupKeys of groups) {
            const merged = {};
            const indices = [];
            for (let i = 0; i < configArray.length; i++) {
                const item = configArray[i];
                if (!item || typeof item !== "object") continue;
                let hasGroupValue = false;
                for (const key of groupKeys) {
                    if (Object.prototype.hasOwnProperty.call(item, key)) {
                        merged[key] = item[key];
                        hasGroupValue = true;
                    }
                }
                if (hasGroupValue) indices.push(i);
            }
            if (indices.length > 1) {
                for (let i = indices.length - 1; i >= 0; i--) {
                    configArray.splice(indices[i], 1);
                }
                configArray.push(merged);
            }
        }
    },

    generateFromTargets: async function(userSettings) {
        const characterName = (userSettings.Character || "").toString().trim();
        if (!characterName) {
            log.info("user_settings.json 中未配置角色名，跳过自动生成 config.json");
            return false;
        }

        const targetLevel = CultivationMaterialCalculator.parseLevelTarget(userSettings.bossRequireCounts, 80);
        const targetTalents = CultivationMaterialCalculator.parseTalentTargets(userSettings.talentBookRequireCounts);
        const currentLevel = 1;
        const currentTalents = [1, 1, 1];

        const configArray = this.readConfigArray();

        const bossCount = CultivationMaterialCalculator.calculateBossCount(currentLevel, targetLevel);
        const talentBookCounts = CultivationMaterialCalculator.calculateTalentBookCounts(currentTalents, targetTalents);
        const localNeed = CultivationMaterialCalculator.calculateLocalNeed(currentLevel, targetLevel);
        const monsterNeed = CultivationMaterialCalculator.calculateMonsterNeedStar3(
            currentLevel,
            targetLevel,
            currentTalents,
            targetTalents
        );

        this.updateConfigObject(configArray, {
            characterLevel: currentLevel,
            characterBreak: "1级未突破",
            talentLevels: currentTalents.join("-"),
            bossRequireCounts0: bossCount,
            talentBookRequireCounts0: talentBookCounts.join("-"),
            needLocalAmount: localNeed,
            needMonsterStar3: monsterNeed,
            weaponMaterialRequireCounts0: "0-0-0-0",
            "needamount1 stars3": 0,
            "needamount2 stars3": 0
        });

        try {
            const wikiMaterials = await WikiFetcher.getCharacterMaterialsFast(characterName);
            if (wikiMaterials) {
                this.updateConfigObject(configArray, {
                    bossMaterialNameRaw: wikiMaterials.bossMaterialName || "",
                    bossMaterialName: wikiMaterials.bossMaterialName || "",
                    talentMobMaterialNameRaw: wikiMaterials.talentMobMaterialName || "",
                    "Magic material0": wikiMaterials.talentMobMaterialName || "",
                    LocalSpecialties: wikiMaterials.specialtyName || "",
                    talentDomainName: wikiMaterials.talentBookName || ""
                });
            }
        } catch (error) {
            log.warn(`获取 BiliWiki 材料名称失败，保留已有 config 名称字段: ${error.message}`);
        }

        this.mergeConfigGroups(configArray);
        file.writeTextSync(Constants.CONFIG_PATH, JSON.stringify(configArray, null, 2));
        log.info("已根据 user_settings.json 自动生成 data/run_data/config.json");
        return true;
    },

    generateFromUserSettings: async function() {
        const userSettings = this.readUserSettings();
        return await this.generateFromTargets(userSettings);
    }
};

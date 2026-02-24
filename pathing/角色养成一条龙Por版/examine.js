// 角色查找与等级识别脚本（精简版）
async function findCharacterAndGetLevel() {
    try {
        log.info("📌 校准并返回游戏主界面...");
        setGameMetrics(1920, 1080, 1);
        await genshin.returnMainUi();
        await sleep(1500);
        log.info("✅ 游戏主界面已加载");

        // 读取配置（仅保留targetWeapon配置读取，删除后续非硬逻辑引用）
        const targetName = settings.Character?.trim() || "";
        const targetElement = settings.Element?.trim() || "";
        const targetWeapon = settings.weaponType?.trim() || "";

        // 打开角色页面
        log.info("打开角色页面...");
        keyPress("VK_C");
        await sleep(1500);
        log.info(`查找目标角色：${targetName}（${targetElement}）`);
        let targetFound = false;

        // 常量配置（统一管理）
        const CONSTS = {
            replacementMap: { 
                "卵": "卯", "姐": "妲", "去": "云", "日": "甘", "螨": "螭", 
                "知": "矢", "钱": "钺", "础": "咄", "厘": "匣", "排": "绯", 
                "朦": "曚", "矿": "斫", "镰": "簾", "廉": "簾", "救": "赦", 
                "塑": "槊", "雍": "薙" 
            },
            ocrRegions: {
                character: { x: 1463, y: 135, width: 256, height: 32 },
                checkChar: { x: 1464, y: 124, width: 250, height: 45 },
                breakStatus: { x: 815, y: 323, width: 302, height: 37 },
                weaponLevel1: { x: 1290, y: 174, width: 113, height: 44 },
                weaponLevel2: { x: 765, y: 745, width: 408, height: 43 },
                talentNormal: { x: 1625, y: 166, width: 80, height: 35 },
                talentSkill: { x: 1625, y: 260, width: 80, height: 35 },
                talentBurst: { x: 1625, y: 351, width: 80, height: 35 },
                talentBurstBackup: { x: 1625, y: 439, width: 80, height: 35 },
                // 材料识别区域
                monsterMaterialDesc: { x: 740, y: 444, width: 404, height: 560 },
                threeStarMaterialCount: { x: 741, y: 859, width: 404, height: 144 },
                localSpecialtyName: { x: 707, y: 122, width: 271, height: 224 },
                localSpecialtyCount: { x: 747, y: 817, width: 395, height: 204 },
                // 前往采集识别区域
                goCollect: { x: 720, y: 548, width: 410, height: 310 },
                // 地图详情页特产名称识别区域
                mapLocalName: { x: 1487, y: 14, width: 364, height: 42 },
                // 新增：武器魔物材料识别区域
                monsterCheck: { x: 723, y: 575, width: 402, height: 357 },
                probabilityGet: { x: 1438, y: 215, width: 466, height: 450 },
                star1MaterialCount: { x: 725, y: 818, width: 418, height: 193 },
                talentLevel: { x: 50, y: 318, width: 147, height: 36 } // 新增天赋等级识别区域
            },
            elements: ["火", "水", "草", "雷", "风", "冰", "岩", "物"],
            avatarDataPath: "assets/combat_avatar.json",
            starTemplatePath: "assets/weapon_star.png",
            starCaptureRegion: { X: 1464, Y: 324, Width: 162, Height: 28 },
            charLevels: [20, 40, 50, 60, 70, 80],
            charBossMaterialRules: { 20:0, 40:2, 50:4, 60:8, 70:12, 80:20 },
            weaponMaterialRules: {
                "三星": {20:[2,0,0,0], 40:[0,2,0,0], 50:[0,4,0,0], 60:[0,0,2,0], 70:[0,0,4,0], 80:[0,0,0,3]},
                "四星": {20:[3,0,0,0], 40:[0,3,0,0], 50:[0,6,0,0], 60:[0,0,3,0], 70:[0,0,6,0], 80:[0,0,0,4]},
                "五星": {20:[5,0,0,0], 40:[0,5,0,0], 50:[0,9,0,0], 60:[0,0,5,0], 70:[0,0,9,0], 80:[0,0,0,6]},
                "未知星级": [0,0,0,0], "识别异常": [0,0,0,0]
            },
            talentBookRules: {
                "1-2":[3,0,0], "2-3":[0,2,0], "3-4":[0,4,0], "4-5":[0,6,0], "5-6":[0,9,0],
                "6-7":[0,0,4], "7-8":[0,0,6], "8-9":[0,0,12], "9-10":[0,0,16]
            },
            // 角色突破魔物材料配置
            charLevels: [20, 40, 50, 60, 70, 80],
            charBreakMonsterRules: {
                20: { star1: 3, star2: 0, star3: 0 },
                40: { star1: 15, star2: 0, star3: 0 },
                50: { star1: 0, star2: 12, star3: 0 },
                60: { star1: 0, star2: 18, star3: 0 },
                70: { star1: 0, star2: 0, star3: 12 },
                80: { star1: 0, star2: 0, star3: 24 }
            },
            // 角色突破区域特产配置
            charBreakLocalRules: {
                20: 3,
                40: 10,
                50: 20,
                60: 30,
                70: 45,
                80: 60
            },
            // 天赋升级魔物材料配置
            talentMonsterRules: {
                "1-2": { star1: 6, star2: 0, star3: 0 },
                "2-3": { star1: 0, star2: 3, star3: 0 },
                "3-4": { star1: 0, star2: 4, star3: 0 },
                "4-5": { star1: 0, star2: 6, star3: 0 },
                "5-6": { star1: 0, star2: 9, star3: 0 },
                "6-7": { star1: 0, star2: 0, star3: 4 },
                "7-8": { star1: 0, star2: 0, star3: 6 },
                "8-9": { star1: 0, star2: 0, star3: 9 },
                "9-10": { star1: 0, star2: 0, star3: 12 }
            }
        };

        // 加载角色数据
        const loadAvatarData = async () => {
            try {
                const json = file.readTextSync(CONSTS.avatarDataPath);
                const data = JSON.parse(json);
                const aliasMap = {};
                data.forEach(char => {
                    aliasMap[char.name] = char.name;
                    char.alias.forEach(alias => aliasMap[alias] = char.name);
                });
                return { aliasToNameMap: aliasMap };
            } catch (e) {
                log.error(`加载角色数据失败: ${e}`);
                return { aliasToNameMap: {} };
            }
        };

        // 模糊匹配
        const fuzzyMatch = (target, candidates, threshold = 0.6) => {
            const levenshtein = (a, b) => {
                const m = a.length + 1, n = b.length + 1;
                const d = Array(m).fill(null).map(() => Array(n).fill(0));
                for (let i = 0; i < m; i++) d[i][0] = i;
                for (let j = 0; j < n; j++) d[0][j] = j;
                for (let i = 1; i < m; i++) {
                    for (let j = 1; j < n; j++) {
                        const cost = a[i-1] === b[j-1] ? 0 : 1;
                        d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+cost);
                    }
                }
                return d[m-1][n-1];
            };

            let bestMatch = null, bestWeight = 0;
            for (const cand of candidates) {
                const dist = levenshtein(target, cand);
                const kwMatch = cand.includes(target);
                const weight = (kwMatch ? 0.8 : 0) + (1 - dist/Math.max(target.length, cand.length)) * 0.2;
                
                if (weight >= threshold) return cand;
                if (weight > bestWeight) {
                    bestWeight = weight;
                    bestMatch = cand;
                }
            }
            return bestMatch;
        };

        // OCR识别角色名称
        const recognizeText = async (text, region, aliasMap, timeout = 100, retry = 20, max = 5) => {
            const start = Date.now();
            let count = 0;
            const formalName = aliasMap[text] || text;
            let capture = null;

            try {
                capture = captureGameRegion();
                const ocr = RecognitionObject.Ocr(region.x, region.y, region.width, region.height);
                ocr.threshold = 0.8;
                
                while (Date.now() - start < timeout && count < max) {
                    try {
                        const resList = capture.findMulti(ocr);
                        for (const res of resList) {
                            let corrText = res.text;
                            for (const [wrong, correct] of Object.entries(CONSTS.replacementMap)) {
                                corrText = corrText.replace(new RegExp(wrong, 'g'), correct);
                            }
                            const recogName = aliasMap[corrText] || corrText || fuzzyMatch(corrText, Object.values(aliasMap));
                            if (recogName === formalName) return { text: recogName, x: res.x, y: res.y };
                            log.info(`识别到 [ ${corrText} ] 修正为 [ ${recogName} ]`);
                        }
                    } catch (e) { count++; log.warn(`OCR重试${count}/${max}：${e.message}`); }
                    await sleep(retry);
                }
            } finally { capture?.dispose(); }
            return false;
        };

        // 选择元素
        const selectElement = async (element) => {
            if (element === "物") return;
            const elemIdx = CONSTS.elements.indexOf(element);
            const clickX = Math.round(787 + elemIdx * 57.5);
            await click(960, 45);
            await sleep(100);
            leftButtonDown();
            for (let j = 0; j < 10; j++) { moveMouseBy(15, 0); await sleep(10); }
            await sleep(500);
            leftButtonUp();
            await sleep(500);
            await click(clickX, 130);
            await sleep(500);
            await click(540, 45);
            await sleep(200);
        };

        // 选择角色
        const selectCharacter = async (name, region, aliasMap) => {
            for (let i = 0; i < 99; i++) {
                const res = await recognizeText(name, region, aliasMap);
                if (res) return res.text;
                await click(1840, 540);
                await sleep(200);
            }
            log.warn(`未找到角色：${name}`);
            return "";
        };

        // 通用重试函数
        const retryTask = async (task, name, max = 3, delay = 1000) => {
            let res = null, count = 0;
            while (count < max) {
                try {
                    res = await task();
                    if (res) return res;
                } catch (e) { log.warn(`${name}重试${count+1}/${max}：${e.message}`); }
                count++;
                if (count < max) await sleep(delay);
            }
            log.error(`${name}重试${max}次失败`);
            return res;
        };

        // 识别多段文字OCR
        const recognizeMultiText = async (region, name) => {
            return await retryTask(() => {
                const ocr = RecognitionObject.ocr(region.x, region.y, region.width, region.height);
                const capture = captureGameRegion();
                const resList = capture.findMulti(ocr);
                const textList = [];
                
                for (let i = 0; i < resList.Count; i++) {
                    const res = resList[i];
                    let text = res.text?.trim() || "";
                    // 替换错误文字
                    for (const [wrong, correct] of Object.entries(CONSTS.replacementMap)) {
                        text = text.replace(new RegExp(wrong, 'g'), correct);
                    }
                    if (text) textList.push(text);
                    res.Dispose();
                }
                
                capture.dispose();
                return textList;
            }, name);
        };

        // 提取魔物名称
        const extractMonsterNames = (textList) => {
            const monsterNames = [];
            const regex = /(\d+)级以上([^，。\s]+)[:：]?[^\n]*掉落/;
            
            textList.forEach(text => {
                const match = text.match(regex);
                if (match && match[2] && !monsterNames.includes(match[2])) {
                    // ===== 清洗魔物名称 =====
                    let cleanName = match[2]
                        .replace(/少量|大量|少许|多量/g, '')// 移除「少量」「大量」等冗余描述
                        .replace(/[^\u4e00-\u9fa50-9·]/g, '')// 移除特殊符号（保留中文、数字、·，移除其他符号）
                        .trim();// 去除首尾空格/空字符
                    // ===== 清洗结束 =====
                    
                    // 确保清洗后的名称非空且未重复
                    if (cleanName && !monsterNames.includes(cleanName)) {
                        monsterNames.push(cleanName);
                    }
                }
            });
            
            return monsterNames;
        };

        // 提取数字
        const extractNumber = (textList, keyword) => {
            for (const text of textList) {
                if (text.includes(keyword)) {
                    const match = text.match(/(\d+)/);
                    if (match && !isNaN(parseInt(match[1]))) {
                        return parseInt(match[1]);
                    }
                }
            }
            return 0;
        };

        // 提取区域特产名称（从地图详情页提取纯净名称）
        const extractPureLocalName = (text) => {
            // 去除「采集区域」相关后缀
            const pureName = text.replace(/采集区域|采集点|获取区域/g, "").trim();
            // 兜底：如果处理后为空，返回默认值
            return pureName || "未知区域特产";
        };

        // 识别魔物名称和材料数量
        const identifyMonsterAndMaterials = async () => {
            const result = { monsterNames: [], star1: 0, star2: 0, star3: 0 };
            try {
                // 1. 识别 "掉落"并点击第一个掉落的文字中心坐标
                const monsterCheckTextList = await retryTask(() => {
                     const ocr = RecognitionObject.ocr(CONSTS.ocrRegions.monsterCheck.x, CONSTS.ocrRegions.monsterCheck.y, CONSTS.ocrRegions.monsterCheck.width, CONSTS.ocrRegions.monsterCheck.height);
                     const capture = captureGameRegion();
                     const resList = capture.findMulti(ocr);
                     const items = [];
                     for(let i=0; i<resList.Count; i++){
                        const res = resList[i];
                        if(res.text && res.text.includes("掉落")) {
                             items.push({x: Math.round(res.x + res.width/2), y: Math.round(res.y + res.height/2)});
                        }
                        res.Dispose();
                     }
                     capture.dispose();
                     return items;
                }, "识别掉落");
                
                if(monsterCheckTextList && monsterCheckTextList.length > 0) {
                     // 点击第一个掉落的文字中心坐标
                     await click(monsterCheckTextList[0].x, monsterCheckTextList[0].y);
                     await sleep(500);
                } else {
                    log.warn("未识别到'掉落'");
                }

                // 2. 连续点击
                // 点击坐标X48, Y444，间隔300毫秒，连续点击四次
                for(let i=0; i<4; i++) {
                    await click(48, 444);
                    await sleep(300);
                }

                await click(960, 540); await sleep(500);
                await click(1566, 736); await sleep(800);

                // 3. 识别 "概率获得"
                 let star1Coords = { x: 0, y: 0 };
                 const probTextList = await retryTask(() => {
                     const ocr = RecognitionObject.ocr(CONSTS.ocrRegions.probabilityGet.x, CONSTS.ocrRegions.probabilityGet.y, CONSTS.ocrRegions.probabilityGet.width, CONSTS.ocrRegions.probabilityGet.height);
                     const capture = captureGameRegion();
                     const resList = capture.findMulti(ocr);
                     const items = [];
                     for(let i=0; i<resList.Count; i++){
                        const res = resList[i];
                        if(res.text && res.text.includes("概率获得")) {
                             items.push({x: Math.round(res.x + res.width/2), y: Math.round(res.y + res.height/2)});
                        }
                        res.Dispose();
                     }
                     capture.dispose();
                     return items;
                }, "识别概率获得");

                if(probTextList && probTextList.length > 0) {
                     // 4.计算它的中心坐标然后点击中心坐标X向右偏移270，Y向下偏移77的坐标
                     star1Coords = { x: probTextList[0].x + 270, y: probTextList[0].y + 77 };
                     await click(star1Coords.x, star1Coords.y);//点击一星材料 
                     await sleep(800);
                } else {
                    log.warn("未识别到'概率获得'");
                }
                 // 5.识别一星武器材料数量
                const star1TextList = await recognizeMultiText(CONSTS.ocrRegions.star1MaterialCount, "一星武器材料数量");
                result.star1 = extractNumber(star1TextList, "当前拥有");
                // 然后按esc退出一星魔物材料详情页
                keyPress("VK_ESCAPE");
                await sleep(500);
               if(star1Coords.x > 0) {
                     await click(star1Coords.x - 180, star1Coords.y);// 一星魔物材料详情页的坐标，X轴向右偏移180，就是三星材料详情页的坐标
                     await sleep(800);
                // 滑动并识别
                // 鼠标左键移动到X970，Y428按下，向上滑动90松开鼠标左键
                moveMouseTo(970, 428);
                await sleep(100);
                leftButtonDown();
                const steps = 10;
                const stepDist = -9; 
                for(let k=0; k<steps; k++) {
                    moveMouseBy(0, stepDist);
                    await sleep(10);
                }
                await sleep(500);
                leftButtonUp();
                await sleep(800);
                // 6. 识别材料详情
                // 识别X740，Y444，W404，H560区域（这个区域包含多段文字）的所有文字
                const monsterTextList = await recognizeMultiText(CONSTS.ocrRegions.monsterMaterialDesc, "武器魔物材料描述");
                
                // 识别掉落材料的敌人魔物名字
                // 例如：40级以上愚人众特辖队少量掉落，70级以上愚人众特辖队掉落 -> 提取名字：愚人众特辖队
                const monsterNames = extractMonsterNames(monsterTextList);
                result.monsterNames = monsterNames;
                log.info(`识别到武器材料魔物名称: ${monsterNames.join(", ")}`);
                // 识别二星魔物材料数量，识别到的文字为例如，可合成数量:31，二星魔物材料数量为31-（当前拥有的一星武器材料数量/3）*3=93个
                // 兜底逻辑：如果提取结果不是有效数字，默认赋值为 0
                const star1 = Number(result.star1) || 0;
                //  将 star1 处理为能被3整除的数（舍去余数）
                const star1MultipleOf3 = Math.floor(star1 / 3) * 3;
                // 计算可合成数量并最终得到 result.star2
                const synthesizableCount = extractNumber(monsterTextList, "可合成数量") || 0; // 同样做兜底
                result.star2 = Math.round(synthesizableCount * 3 - star1MultipleOf3 / 3);
                // 识别三星魔物材料的数量，识别到的文字例如，当前拥有17，三星魔物材料数量为17
                result.star3 = extractNumber(monsterTextList, "当前拥有");
  
                }

                // 7. 退出
                // 然后间隔1000按4次esc退出材料详情页，回到武器突破页
                for(let i=0; i<4; i++) {
                    keyPress("VK_ESCAPE");
                    await sleep(1000);
                }

            } catch(e) {
                log.error(`武器魔物材料识别失败: ${e.message}`);
            }
            return result;
        };

        // 计算角色突破所需魔物材料
        const calcCharBreakMonster = (currLvl, targetLvl) => {
    const need = { star1: 0, star2: 0, star3: 0 };
    const validLevels = [20, 40, 50, 60, 70, 80];
    // 核心判断：满足任一条件则返回0
    const isAlreadyBroken = currLvl === '已突破';
    const isTargetValidNumber = typeof targetLvl === 'number' && validLevels.includes(targetLvl);
    const isCurrValidNumber = typeof currLvl === 'number' && validLevels.includes(currLvl);
    const isLevelDescend = isCurrValidNumber && isTargetValidNumber && targetLvl < currLvl;

    if (isAlreadyBroken || !isTargetValidNumber || isLevelDescend) {
        return need;
    }
    // 计算所需材料
    for (const lvl of CONSTS.charLevels) {
        if (lvl >= currLvl && lvl <= targetLvl) {
            const rules = CONSTS.charBreakMonsterRules[lvl];
            if (rules) {
                need.star1 += rules.star1 || 0;
                need.star2 += rules.star2 || 0;
                need.star3 += rules.star3 || 0;
            }
        }
    }
    return need;
};

        // 计算天赋升级所需魔物材料
        const calcTalentMonster = (currTalents, targetTalents) => {
            const need = { star1: 0, star2: 0, star3: 0 };
            
            for (let i = 0; i < 3; i++) {
                const curr = currTalents[i] || 1;
                const target = targetTalents[i] || 1;
                
                if (curr >= target) continue;
                
                for (let lvl = curr; lvl < target; lvl++) {
                    const key = `${lvl}-${lvl+1}`;
                    const rules = CONSTS.talentMonsterRules[key] || { star1: 0, star2: 0, star3: 0 };
                    need.star1 += rules.star1;
                    need.star2 += rules.star2;
                    need.star3 += rules.star3;
                }
            }
            
            return need;
        };

        // 转换材料为三星等价物
        const convertToThreeStar = (star1, star2, star3) => {
            // 3个一星 = 1个二星，3个二星 = 1个三星
            const totalStar2 = star2 + Math.floor(star1 / 3);
            const remainStar1 = star1 % 3;
            const totalStar3 = star3 + Math.floor(totalStar2 / 3);
            const remainStar2 = totalStar2 % 3;
            
            return {
                totalStar3,
                remainStar1,
                remainStar2,
                allConvert: totalStar3 + Math.floor((remainStar2 + Math.floor(remainStar1 / 3)) / 3)
            };
        };

        // 计算角色突破所需区域特产
        const calcCharBreakLocal = (currLvl, targetLvl) => {
    let need = 0;
    // 从统一配置中提取6个突破等级，转为数字并排序
    const breakLevels = Object.keys(CONSTS.charBreakLocalRules).map(Number).sort((a, b) => a - b);

    // 过滤出：≥当前等级 且 ≤目标等级 的突破节点（未突破状态，包含两端）
    const needLevels = breakLevels.filter(lvl => lvl >= currLvl && lvl <= targetLvl);
    
    // 累加这些节点的材料数量（从CONSTS中读取对应数值）
    needLevels.forEach(lvl => {
        need += CONSTS.charBreakLocalRules[lvl];
    });

    return need;
};

        // 解析天赋等级
        const parseTalent = (text) => {
            const match = text.trim().match(/Lv\.(\d+)/);
            return match && match[1] ? match[1] : "";
        };

        // 识别单个天赋
        const getTalentLevel = async (region, name) => {
            const text = await retryTask(() => {
                const ocr = RecognitionObject.ocr(region.x, region.y, region.width, region.height);
                const capture = captureGameRegion();
                const res = capture.find(ocr);
                capture.dispose();
                return res.text || "";
            }, name);
            return parseTalent(text);
        };

        // 检查角色核心逻辑
        const checkCharacter = async (x, y) => {
            // 点击角色头像
            click(x, y);
            await sleep(800);

            // 加载角色数据并识别
            const { aliasToNameMap } = await loadAvatarData();
            const recogName = await selectCharacter(targetName, CONSTS.ocrRegions.checkChar, aliasToNameMap);
            log.info(`检测到角色：${recogName}（坐标：${x},${y}）`);
            if (!recogName) return false;
            // 识别角色突破状态
            setGameMetrics(1920, 1080, 1.25);
            click(962, 612);
            await sleep(800);          
            // 识别武器星级
            click(181, 223);
            await sleep(800);

            let weaponStar = "未知星级";
            // 初始化武器魔物材料结果
            let weaponMaterialResult = {
                weapon1: { monsterNames: [], star1: 0, star2: 0, star3: 0 },
                weapon2: { monsterNames: [], star1: 0, star2: 0, star3: 0 }
            };
            try {
                const starCount = await retryTask(async () => {
                    const capture = captureGameRegion(CONSTS.starCaptureRegion.X, CONSTS.starCaptureRegion.Y, CONSTS.starCaptureRegion.Width, CONSTS.starCaptureRegion.Height);
                    const template = file.readImageMatSync(CONSTS.starTemplatePath);
                    if (!template) throw new Error("模板加载失败");
                    
                    const matchObj = RecognitionObject.TemplateMatch(template);
                    const matches = capture.FindMulti(matchObj);
                    const count = matches?.Count || 0;
                    
                    for (let i = 0; i < matches?.Count; i++) matches[i].Dispose();
                    capture.Dispose();
                    template.Dispose();
                    return count;
                }, "武器星级模板匹配");

                weaponStar = starCount === 1 ? "一星" : 
                             starCount === 3 ? "三星" : 
                             starCount === 4 ? "四星" : 
                             starCount === 5 ? "五星" : 
                             `无法识别（${starCount}）`;
            } catch (e) {
                log.error(`武器星级识别异常：${e.message}`);
                weaponStar = "识别异常";
            }
            log.info(`武器星级：${weaponStar}`);

            // 一星武器跳过等级识别 + 不退出武器详情
let weaponLevel = ""; // 提前声明变量，避免作用域问题
// 新增：标记是否为90级满级（默认判定的情况）
let isWeaponMaxLevel = false;

if (weaponStar === "一星") {
    log.info("💡 一星武器无需培养，跳过武器等级识别");
    weaponLevel = "一星武器（跳过识别等级）";
} else {
    // 非一星武器：执行原有等级识别逻辑
    click(1721, 1007);
    await sleep(800);
    // 清理文本函数
    const cleanText = (str) => str.replace(/[。：、，.·-]/g, "").trim();

    // 识别武器等级1
    const levelText1 = await retryTask(() => {
        const region = RecognitionObject.ocr(CONSTS.ocrRegions.weaponLevel1.x, CONSTS.ocrRegions.weaponLevel1.y, CONSTS.ocrRegions.weaponLevel1.width, CONSTS.ocrRegions.weaponLevel1.height);
        const capture = captureGameRegion();
        const res = capture.find(region);
        const text = cleanText(res.text || "");
        capture.dispose();
        return text;
    }, "武器等级（区域1）");

    if (levelText1) {
        const match = levelText1.match(/等级(\d+)|(\d+)级/);
        weaponLevel = match ? `${match[1] || match[2]}级未突破` : "";

        // 只有识别到有效等级（非90级满级）时才识别材料
        if (weaponLevel) {
             log.info("识别武器魔物材料（区域1）...");
             // 识别第一种
             log.info("识别第一种武器材料...");
             await click(1640, 880);
             await sleep(800);
             weaponMaterialResult.weapon1 = await identifyMonsterAndMaterials();
             log.info(`✅ 第一种武器材料：${JSON.stringify(weaponMaterialResult.weapon1)}`);
             // 识别第二种
             log.info("识别第二种武器材料...");
             await click(1524, 881);
             await sleep(800);
             weaponMaterialResult.weapon2 = await identifyMonsterAndMaterials();
             log.info(`✅ 第二种武器材料：${JSON.stringify(weaponMaterialResult.weapon2)}`);
        }
    }

    // 识别武器等级2（备用）
    if (!weaponLevel) {
        click(1529, 1017);
        await sleep(800);
        const levelText2 = await retryTask(() => {
            const region = RecognitionObject.ocr(CONSTS.ocrRegions.weaponLevel2.x, CONSTS.ocrRegions.weaponLevel2.y, CONSTS.ocrRegions.weaponLevel2.width, CONSTS.ocrRegions.weaponLevel2.height);
            const capture = captureGameRegion();
            const res = capture.find(region);
            const text = cleanText(res.text || "");
            capture.dispose();
            return text;
        }, "武器等级（区域2）");
        
        if (levelText2) {
            const match = levelText2.match(/提升到(\d+)级|等级(\d+)|(\d+)级/);
            const tempLevel = match ? `${match[1] || match[2] || match[3]}级未突破` : "";
            
            if (tempLevel) {
                 weaponLevel = tempLevel;
                 log.info(`备用区域识别到武器等级：${tempLevel}`);
                 
                 // 只有识别到有效等级时才识别材料
                 log.info("识别武器魔物材料（区域2）...");
                 // 识别第一种
                 log.info("识别第一种武器材料...");
                 await click(1099, 491);
                 await sleep(800);
                 weaponMaterialResult.weapon1 = await identifyMonsterAndMaterials();
                 log.info(`✅ 第一种武器材料（备用区域）：${JSON.stringify(weaponMaterialResult.weapon1)}`);

                 // 识别第二种
                 log.info("识别第二种武器材料...");
                 await click(956, 491);
                 await sleep(800);
                 weaponMaterialResult.weapon2 = await identifyMonsterAndMaterials();
                 log.info(`✅ 第二种武器材料（备用区域）：${JSON.stringify(weaponMaterialResult.weapon2)}`);
            }

            keyPress("VK_ESCAPE");
            await sleep(500);
        }
    }

    // 判定武器满级：当weaponLevel为空时（识别失败），标记为90级满级并跳过材料识别
    if (!weaponLevel) {
        weaponLevel = "90级已突破（满级）";
        isWeaponMaxLevel = true;
        log.info("💡 武器等级识别失败，判定为90级满级，跳过魔物材料识别");
    }
    
    log.info(`武器突破等级：${weaponLevel}`);
    // 非一星武器：执行退出武器详情
    keyPress("VK_ESCAPE");
    await sleep(1500);
}

// 一星武器：单独输出等级日志（保证日志完整性）
if (weaponStar === "一星") {
    log.info(`武器突破等级：${weaponLevel}`);
}

// ======================== 核心函数：获取单个天赋等级（修复Lv.X格式解析）========================
/**
 * 获取单个天赋等级
 * @param {Object} ocrRegion OCR识别区域 {x,y,width,height}
 * @param {string} talentName 天赋名称（用于日志）
 * @returns {number|null} 天赋等级，识别失败返回null
 */
const getTalentLevel = async (ocrRegion, talentName) => {
    try {
        log.info(`${talentName}等级，OCR区域：x=${ocrRegion.x}, y=${ocrRegion.y}, w=${ocrRegion.width}, h=${ocrRegion.height}`);
        
        const ocr = RecognitionObject.ocr(ocrRegion.x, ocrRegion.y, ocrRegion.width, ocrRegion.height);
        const capture = captureGameRegion();
        const resList = capture.findMulti(ocr);
        
        // 扩展正则：Lv.X格式
        const lvRegex = /Lv\.(\d+)/;                // 匹配 Lv.10
        const pureNumRegex = /\d+/;                 // 兜底：提取纯数字
        
        const allTexts = [];
        let level = null;
        
        for (let j = 0; j < resList.Count; j++) {
            const res = resList[j];
            if (res && res.text) {
                const text = res.text.trim();
                allTexts.push(text);
                               
                match = text.match(lvRegex);
                if (match) {
                    level = parseInt(match[1], 10);
                    log.info(`${talentName}匹配到等级：${level} 级  文本：${text}`);
                    break;
                }
                
            }
            if (res) res.Dispose();
        }
        
        // 输出识别到的所有文本（调试用）
        if (allTexts.length > 0) {
           // log.info(`${talentName}识别到的所有文本：${allTexts.join(" | ")}`);
        } else {
            log.warn(`${talentName}未识别到任何文本`);
        }
        capture.dispose();
        // 容错：直接提取数字（修复NaN问题）
        if (!level && allTexts.length > 0) {
            for (const text of allTexts) {
                const numMatch = text.match(pureNumRegex);
                if (numMatch) {
                    const num = parseInt(numMatch[0], 10); // 修复：用numMatch[0]而非[1]
                    if (!isNaN(num)) { // 校验是否为有效数字
                        level = num;
                        log.info(`${talentName}从文本中提取数字作为等级：${level}（文本：${text}）`);
                        break;
                    } else {
                        log.warn(`${talentName}提取到非有效数字：${numMatch[0]}（文本：${text}）`);
                    }
                }
            }
        }
        // 最终校验：确保返回有效数字或null
        return !isNaN(level) ? level : null;
    } catch (e) {
        log.error(`识别${talentName}等级出错：${e.message || e}`);
        return null;
    }
};

// ======================== 第一步：打开天赋页面并识别等级 ========================
log.info("开始识别天赋等级...");
// 打开天赋等级详情页
click(189, 431);
await sleep(800); 

//分别识别各天赋等级（爆发优先常规区域，失败用备用）
const talentNormal = await getTalentLevel(CONSTS.ocrRegions.talentNormal, "普通攻击");
const talentSkill = await getTalentLevel(CONSTS.ocrRegions.talentSkill, "元素战技");
let talentBurst = await getTalentLevel(CONSTS.ocrRegions.talentBurst, "元素爆发");
if (!talentBurst) talentBurst = await getTalentLevel(CONSTS.ocrRegions.talentBurstBackup, "元素爆发（备用）");

// 处理默认值（识别失败时用1级，保持和你原代码一致的兜底逻辑）
const talentLevels = [
    talentNormal || 1,
    talentSkill || 1,
    talentBurst || 1
];
log.info(`等级识别完成：普攻=${talentLevels[0]} 级, 战技=${talentLevels[1]} 级, 爆发=${talentLevels[2]} 级`);

// ======================== 第二步：识别命座加成（按你的需求调整）========================
log.info("开始识别命座加成...");

// 检查命座加成的通用函数
const checkConstellationBonus = async (talentName = "未知天赋") => {
    try {
        const ocr = RecognitionObject.ocr(28, 270, 155, 49); // 命座加成识别区域
        const capture = captureGameRegion();
        const resList = capture.findMulti(ocr);
        let hasBonus = false;
        const allTexts = [];
        
        for(let i=0; i<resList.Count; i++){
            if(resList[i] && resList[i].text) {
                const text = resList[i].text.trim();
                allTexts.push(text);
                if(text.includes("天赋等级+3") || text.includes("等级+3")){
                    hasBonus = true;
                    break;
                }
            }
            if (resList[i]) resList[i].Dispose();
        }
        
        log.info(`${talentName}命座加成识别文本：${allTexts.join(" | ")}`);
        //ESC退出天赋详情
        keyPress("VK_ESCAPE");
        await sleep(1000);
        capture.dispose();
        
        // 容错：模糊匹配
        if(!hasBonus && allTexts.length > 0) {
            for(const text of allTexts) {
                if(text.includes("+3") && (text.includes("天赋") || text.includes("等级"))) {
                    hasBonus = true;
                    log.info(`模糊匹配到${talentName}命座加成`);
                    break;
                }
            }
        }
        
        return hasBonus;
    } catch (e) {
        log.error(`检查${talentName}命座加成出错：${e.message || e}`);
        return false;
    }
};

// 天赋按钮坐标（用于切换天赋页检查命座）
const talentPositions = {
    skill: { x: 1760, y: 260, name: "战技" },
    burst: { x: 1760, y: 348, name: "爆发" },
    burstBackup: { x: 1760, y: 441, name: "爆发(备用)" }
};

// 1. 元素战技：检查命座加成（普攻不检查）
if (talentLevels[1] > 3) { // 等级>3才检查，避免1级误判
    log.info("检查元素战技命座加成...");
    await click(talentPositions.skill.x, talentPositions.skill.y);
    await sleep(800);
    if (await checkConstellationBonus("元素战技")) {
        talentLevels[1] = Math.max(1, talentLevels[1] - 3);
        log.info(`元素战技命座加成修正后等级：${talentLevels[1]} 级`);
        //ESC退出天赋详情
        keyPress("VK_ESCAPE");
        await sleep(800);
    }
}

// 2. 元素爆发：检查命座加成（和等级识别区域联动）
if (talentLevels[2] > 3) {
    log.info("检查元素爆发命座加成...");
    let burstBonusFound = false;
    
    // 等级从常规区域识别到 → 查常规位置；否则查备用位置
    if (talentBurst === await getTalentLevel(CONSTS.ocrRegions.talentBurst, "元素爆发")) {
        await click(talentPositions.burst.x, talentPositions.burst.y);
        await sleep(800);
        burstBonusFound = await checkConstellationBonus("元素爆发(常规)");
    } else {
        await click(talentPositions.burstBackup.x, talentPositions.burstBackup.y);
        await sleep(800);
        burstBonusFound = await checkConstellationBonus("元素爆发(备用)");
    }

    if (burstBonusFound) {
        talentLevels[2] = Math.max(1, talentLevels[2] - 3);
        log.info(`元素爆发命座加成修正后等级：${talentLevels[2]} 级`);
    }
}

// 最终结果输出
const finalTalentLevels = `${talentLevels[0]}-${talentLevels[1]}-${talentLevels[2]}`;
log.info(`最终天赋等级：${finalTalentLevels}`);

const currTalents = talentLevels;
const targetTalents = (settings?.talentBookRequireCounts || "10-10-10")
    .split('-')
    .map(l => isNaN(parseInt(l)) ? 10 : parseInt(l));
            // 识别角色等级
            await sleep(800);
            click(170, 152);
            await sleep(800);
            click(1779, 190);
            await sleep(800);

            const breakStatus = await retryTask(() => {
                const region = RecognitionObject.ocr(CONSTS.ocrRegions.breakStatus.x, CONSTS.ocrRegions.breakStatus.y, CONSTS.ocrRegions.breakStatus.width, CONSTS.ocrRegions.breakStatus.height);
                const capture = captureGameRegion();
                const res = capture.find(region);
                const text = res.text?.trim() || "";
                capture.dispose();
                return text;
            }, "角色突破状态");

            let breakResult = "未知突破状态";
            if (breakStatus.includes("已突破")) {
                breakResult = "90级已突破";
            } else {
                const levelMatch = breakStatus.match(/(\d+)级/);
                if (levelMatch) {
                    const level = `${levelMatch[1]}级未突破`;
                    breakResult = ["20","40","50","60","70","80"].includes(levelMatch[1]) ? level : `${level}（非标准等级）`;
                } else {
                    breakResult = `无法识别（${breakStatus}）`;
                }
            }
            log.info(`角色突破状态：${breakResult}`);

            // 解析当前角色等级
            const currCharLvl = breakResult.match(/(\d+)级/) ? parseInt(breakResult.match(/(\d+)级/)[1]) : 0;
            // 解析目标角色等级
            const targetCharLvl = settings.bossRequireCounts ? parseInt(settings.bossRequireCounts.match(/(\d+)级/)[1]) : 80;
            await sleep(800);

            // ======================== 天赋等级识别完成 ========================

            // ======================== 材料识别流程开始 ========================
            // 存储材料数据
            const materialData = {
                localSpecialties: "",
                localAmount: 0,
                monsterMaterials: [],
                star1Amount: 0,
                star2Amount: 0,
                star3Amount: 0,
                needMonsterStar3: 0,
                needLocalAmount: 0
            };

            try {
                // 点击打开魔物材料详情页
                log.info("打开魔物材料详情页...");
                await click(996, 272);
                await sleep(500);
                await click(1171, 525);
                await sleep(1000);

                // 滑动查看完整信息
                log.info("滑动查看材料详情...");
                moveMouseTo(970, 428);
                await sleep(100);
                leftButtonDown();
                const steps = 14;
                const stepDistance = -12;
                for (let j = 0; j < steps; j++) {
                    moveMouseBy(0,stepDistance); // 拖动鼠标
                    await sleep(10);
                }
                await sleep(500);
                leftButtonUp();
                await sleep(500);

                // 识别魔物材料描述和敌人名称
                log.info("识别魔物材料信息...");
                const monsterTextList = await recognizeMultiText(CONSTS.ocrRegions.monsterMaterialDesc, "魔物材料描述");
                const monsterNames = extractMonsterNames(monsterTextList);
                log.info(`识别到魔物名称：${monsterNames.join(", ")}`);

                // 提取一星魔物材料数量（可合成数量 ×3）
                const star1Count = extractNumber(monsterTextList, "可合成数量") * 3;
                materialData.star1Amount = star1Count;
                log.info(`一星魔物材料数量：${star1Count}`);

                // 提取二星魔物材料数量（当前拥有）
                const star2Count = extractNumber(monsterTextList, "当前拥有");
                materialData.star2Amount = star2Count;
                log.info(`二星魔物材料数量：${star2Count}`);

                // 保存魔物名称
                monsterNames.forEach((name, index) => {
                    materialData.monsterMaterials.push({
                        name: name,
                        amount: 0 // 这里可根据实际需求调整，示例中amount为0
                    });
                });

                // 退出魔物材料详情
                keyPress("VK_ESCAPE");
                await sleep(500);

                // 打开三星材料详情页
                log.info("打开三星材料详情页...");
                await click(1128, 272);
                await sleep(500);
                await click(1171, 525);
                await sleep(800);

                // 识别三星魔物材料数量
                const threeStarTextList = await recognizeMultiText(CONSTS.ocrRegions.threeStarMaterialCount, "三星魔物材料数量");
                const star3Count = extractNumber(threeStarTextList, "当前拥有");
                materialData.star3Amount = star3Count;
                log.info(`三星魔物材料数量：${star3Count}`);

                // 退出三星材料详情
                keyPress("VK_ESCAPE");
                await sleep(500);

                // 打开区域特产材料详情页
                log.info("打开区域特产材料详情页...");
                await click(1029, 524);
                await sleep(1200);

                // 识别区域特产数量
                const localCountTextList = await recognizeMultiText(CONSTS.ocrRegions.localSpecialtyCount, "区域特产数量");
                const localCount = extractNumber(localCountTextList, "当前拥有");
                materialData.localAmount = localCount;
                log.info(`区域特产数量：${localCount}`);
                await sleep(500);
                // ========== 识别「前往采集」并点击 ==========
                // ========== 识别「前往采集」并精准点击 ==========
log.info("识别「前往采集」文字...");
const goCollectTextList = await retryTask(() => {
    const ocr = RecognitionObject.ocr(
        CONSTS.ocrRegions.goCollect.x, 
        CONSTS.ocrRegions.goCollect.y, 
        CONSTS.ocrRegions.goCollect.width, 
        CONSTS.ocrRegions.goCollect.height
    );
    const capture = captureGameRegion();
    const resList = capture.findMulti(ocr);
    const textWithPos = []; // 存储文字+坐标
    
    for (let i = 0; i < resList.Count; i++) {
        const res = resList[i];
        let text = res.text?.trim() || "";
        // 替换错误文字
        for (const [wrong, correct] of Object.entries(CONSTS.replacementMap)) {
            text = text.replace(new RegExp(wrong, 'g'), correct);
        }
        if (text) {
            textWithPos.push({
                text: text,
                x: res.x,          // 文字左上角X坐标
                y: res.y,          // 文字左上角Y坐标
                width: res.width,  // 文字宽度
                height: res.height // 文字高度
            });
        }
        res.Dispose();
    }
    capture.dispose();
    return textWithPos;
}, "前往采集文字（带坐标）");

// 筛选出精准匹配「前往采集」的条目
const targetGoCollect = goCollectTextList.find(item => {
    // 严格匹配：包含「前往采集」且排除其他含「采集」的干扰文字
    return item.text === "前往采集" || 
           item.text.includes("前往采集") && 
           !item.text.includes("采集区域") && 
           !item.text.includes("采集点") && 
           !item.text.includes("获取区域");
});

if (targetGoCollect) {
    log.info(`识别到「前往采集」（精准坐标）：文字="${targetGoCollect.text}"，坐标X=${targetGoCollect.x}, Y=${targetGoCollect.y}`);
    // 点击文字区域的中心位置（而非整个识别区域中心）
    const clickX = Math.round(targetGoCollect.x + targetGoCollect.width / 2);
    const clickY = Math.round(targetGoCollect.y + targetGoCollect.height / 2);
    await click(clickX, clickY);
    // 额外过滤：确保点击坐标在合理范围内（可根据实际界面调整）
    const validXRange = [CONSTS.ocrRegions.goCollect.x, CONSTS.ocrRegions.goCollect.x + CONSTS.ocrRegions.goCollect.width];
    const validYRange = [CONSTS.ocrRegions.goCollect.y, CONSTS.ocrRegions.goCollect.y + CONSTS.ocrRegions.goCollect.height];
    if (clickX >= validXRange[0] && clickX <= validXRange[1] && clickY >= validYRange[0] && clickY <= validYRange[1]) {
        log.info(`点击「前往采集」中心位置：X=${clickX}, Y=${clickY}`);
        await click(clickX, clickY);
        await sleep(2000);
    } else {
        log.warn(`「前往采集」坐标超出有效范围，跳过点击：X=${clickX}, Y=${clickY}`);
        // 兜底：使用区域中心点击
        await click(
            CONSTS.ocrRegions.goCollect.x + CONSTS.ocrRegions.goCollect.width / 2,
            CONSTS.ocrRegions.goCollect.y + CONSTS.ocrRegions.goCollect.height / 2
        );
        await sleep(2000);
    }

    // 识别地图详情页的特产名称（原有逻辑保留）
    log.info("识别地图详情页的区域特产名称...");
    const mapNameTextList = await recognizeMultiText(CONSTS.ocrRegions.mapLocalName, "地图详情页特产名称");
    if (mapNameTextList.length > 0) {
        const rawName = mapNameTextList[0];
        materialData.localSpecialties = extractPureLocalName(rawName);
        log.info(`识别到区域特产名称（原始）：${rawName}`);
        log.info(`提取纯净名称：${materialData.localSpecialties}`);
    } else {
        materialData.localSpecialties = "未知区域特产";
        log.warn("未识别到地图详情页的特产名称");
    }

    // 退出地图详情页
    keyPress("VK_ESCAPE");
    await sleep(500);
} else {
    log.warn("未识别到精准的「前往采集」文字，使用原有逻辑提取特产名称");
    // 原有逻辑兜底
    const localNameTextList = await recognizeMultiText(CONSTS.ocrRegions.localSpecialtyName, "区域特产名称");
    materialData.localSpecialties = localNameTextList.find(text => !text.includes("区域特产"))?.trim() || "未知区域特产";
}
// ========== 「前往采集」并识别地图详情页的区域特产名称逻辑结束 ==========

                // 退出区域特产详情
                keyPress("VK_ESCAPE");
                await sleep(500);

                // ======================== 材料数量计算（天赋等级已识别完成） ========================
                log.info("开始计算所需材料数量...");
                // 1. 计算角色突破所需魔物材料
                const charBreakNeed = calcCharBreakMonster(currCharLvl, targetCharLvl);
                log.info(`角色突破所需魔物材料 - 一星：${charBreakNeed.star1}，二星：${charBreakNeed.star2}，三星：${charBreakNeed.star3}`);
                // 2. 计算天赋升级所需魔物材料
                const talentNeed = calcTalentMonster(currTalents, targetTalents);
                log.info(`天赋升级所需魔物材料 - 一星：${talentNeed.star1}，二星：${talentNeed.star2}，三星：${talentNeed.star3}`);
                // 3. 总计所需魔物材料
                const totalNeed = {
                    star1: charBreakNeed.star1 + talentNeed.star1,
                    star2: charBreakNeed.star2 + talentNeed.star2,
                    star3: charBreakNeed.star3 + talentNeed.star3
                };
                log.info(`总计所需魔物材料 - 一星：${totalNeed.star1}，二星：${totalNeed.star2}，三星：${totalNeed.star3}`);

                // 4. 转换现有材料为三星等价物
                const convertResult = convertToThreeStar(
                    materialData.star1Amount,
                    materialData.star2Amount,
                    materialData.star3Amount
                );
                log.info(`现有材料转换为三星等价物：${convertResult.totalStar3}（剩余一星：${convertResult.remainStar1}，剩余二星：${convertResult.remainStar2}）`);

                // 5. 计算还需多少角色等级突破和天赋升级三星魔物材料
                const totalNeedStar3 = convertToThreeStar(totalNeed.star1, totalNeed.star2, totalNeed.star3).totalStar3;
                materialData.needMonsterStar3 = Math.max(0, totalNeedStar3 - convertResult.totalStar3);
                log.info(`角色等级突破和天赋升级还需获取三星魔物材料数量：${materialData.needMonsterStar3}`);

                // 6. 计算区域特产需求
                const localNeed = calcCharBreakLocal(currCharLvl, targetCharLvl);
                materialData.needLocalAmount = Math.max(0, localNeed - materialData.localAmount);
                log.info(`角色突破所需区域特产：${localNeed}，当前拥有：${materialData.localAmount}，还需：${materialData.needLocalAmount}`);

            } catch (e) {
                log.error(`材料识别流程异常：${e.message}`);
            }
            // ======================== 材料识别流程结束 ========================

            // 退出突破预览
            keyPress("VK_ESCAPE");
            await sleep(500);
            log.info("已退出突破预览");

            // 计算突破材料
            // 解析当前等级
            const currWeaponLvl = weaponLevel.match(/(\d+)级/) ? parseInt(weaponLevel.match(/(\d+)级/)[1]) : 0;
            const [currTal1 = 0, currTal2 = 0, currTal3 = 0] = talentLevels;

            // 解析目标等级
            const targetWeaponLvl = settings.weaponMaterialRequireCounts ? parseInt(settings.weaponMaterialRequireCounts.match(/(\d+)级/)[1]) : 80;

            // 计算角色突破BOSS材料
            let charMatCount = 0;
            if (currCharLvl <= targetCharLvl && currCharLvl > 0) {
                for (const lvl of CONSTS.charLevels) {
                    if (lvl >= currCharLvl && lvl <= targetCharLvl) {
                        charMatCount += CONSTS.charBossMaterialRules[lvl] || 0;
                    }
                }
            }

            // 计算武器突破材料
            let weaponMatCount = [0,0,0,0];
            if (weaponStar !== "一星" && weaponStar !== "未知星级" && weaponStar !== "识别异常" && currWeaponLvl <= targetWeaponLvl && currWeaponLvl > 0) {
                const rules = CONSTS.weaponMaterialRules[weaponStar];
                for (const lvl of CONSTS.charLevels) {
                    if (lvl >= currWeaponLvl && lvl <= targetWeaponLvl) {
                        const mat = rules[lvl] || [0,0,0,0];
                        weaponMatCount = weaponMatCount.map((v, i) => v + mat[i]);
                    }
                }
            }

            // 计算天赋材料
            const calcTalentMat = (curr, target) => {
                let total = [0,0,0];
                if (curr >= target || curr < 1 || target > 10) return total;
                for (let lvl = curr; lvl < target; lvl++) {
                    const key = `${lvl}-${lvl+1}`;
                    const mat = CONSTS.talentBookRules[key] || [0,0,0];
                    total = total.map((v, i) => v + mat[i]);
                }
                return total;
            };

            const tal1Mat = calcTalentMat(currTal1, targetTalents[0]);
            const tal2Mat = calcTalentMat(currTal2, targetTalents[1]);
            const tal3Mat = calcTalentMat(currTal3, targetTalents[2]);
            const talentMatCount = [
                tal1Mat[0] + tal2Mat[0] + tal3Mat[0],
                tal1Mat[1] + tal2Mat[1] + tal3Mat[1],
                tal1Mat[2] + tal2Mat[2] + tal3Mat[2]
            ];

            // 构建最终配置
            
            // 计算武器魔物材料需求（新增）
            const calcWeaponMonsterNeed = (curr, target, type) => {
                 // type 1: 3, 12, 27(9*3), 42(14*3), 81(9*9), 162(18*9)
                 const rules = type === 1 ? 
                    { 20: 3, 40: 12, 50: 27, 60: 42, 70: 81, 80: 162 } :
                    { 20: 5, 40: 18, 50: 27, 60: 54, 70: 126, 80: 243 };
                 
                 let total1 = 0;
                 if (curr < target) {
                     for (const lvl of [20, 40, 50, 60, 70, 80]) {
                         if (lvl >= curr && lvl <= target) {
                             total1 += rules[lvl] || 0;
                         }
                     }
                 }
                 return total1;
            };

            const w1Req = calcWeaponMonsterNeed(currWeaponLvl, targetWeaponLvl, 1);
            const w1Owned = weaponMaterialResult.weapon1.star1 + (weaponMaterialResult.weapon1.star2 * 3) + (weaponMaterialResult.weapon1.star3 * 9);
            const weapon1RemainStar3 = Math.max(0, Math.ceil((w1Req - w1Owned) / 9));
            log.info(`✅第一个魔物材料需${w1Req}个star1，当前拥有${w1Owned}个star1，还需${weapon1RemainStar3}个3星魔物材料`);
            const w2Req = calcWeaponMonsterNeed(currWeaponLvl, targetWeaponLvl, 2);
            const w2Owned = weaponMaterialResult.weapon2.star1 + (weaponMaterialResult.weapon2.star2 * 3) + (weaponMaterialResult.weapon2.star3 * 9);
            const weapon2RemainStar3 = Math.max(0, Math.ceil((w2Req - w2Owned) / 9));
            log.info(`✅第二个魔物材料需${w2Req}个star1，当前拥有${w2Owned}个star1，还需${weapon2RemainStar3}个3星魔物材料`);
            
            const finalConfigArray = [];

// 1. 第一个对象：特产、魔物材料及总需求
const materialObj = {
    "LocalSpecialties": materialData.localSpecialties,
    "needLocalAmount": materialData.needLocalAmount,
    "needMonsterStar3": materialData.needMonsterStar3 // 总计值
};
// 动态添加魔物材料名称
materialData.monsterMaterials.forEach((monster, index) => {
    materialObj[`Magic material${index}`] = monster.name;
});
finalConfigArray.push(materialObj);
finalConfigArray.push({
    "bossRequireCounts0": charMatCount
});// 2. 第二个对象：角色突破Boss材料
finalConfigArray.push({
    "weaponMaterialRequireCounts0": weaponMatCount.join("-")
});// 3. 第三个对象：武器突破材料
finalConfigArray.push({
    "talentBookRequireCounts0": talentMatCount.join("-")
});// 4. 第四个对象：天赋升级材料

// ========== 第五个对象 - 武器突破魔物名称和材料配置 ========== 
const weaponConfigObj = {
    "needamount1 stars3": weapon1RemainStar3
};

// 动态添加 Weapons1 materialX
if (weaponMaterialResult.weapon1.monsterNames && weaponMaterialResult.weapon1.monsterNames.length > 0) {
    weaponMaterialResult.weapon1.monsterNames.forEach((name, index) => {
        weaponConfigObj[`Weapons1 material${index}`] = name;
    });
} else {
    weaponConfigObj["Weapons1 material0"] = "";
}

weaponConfigObj["needamount2 stars3"] = weapon2RemainStar3;

// 动态添加 Weapons2 materialX
if (weaponMaterialResult.weapon2.monsterNames && weaponMaterialResult.weapon2.monsterNames.length > 0) {
    weaponMaterialResult.weapon2.monsterNames.forEach((name, index) => {
        weaponConfigObj[`Weapons2 material${index}`] = name;
    });
} else {
    weaponConfigObj["Weapons2 material0"] = "";
}

finalConfigArray.push(weaponConfigObj);
// 保存配置（将对象改为数组）
try {
    file.writeTextSync("config.json", JSON.stringify(finalConfigArray, null, 2));
    log.info(`✅ 材料计算完成，已保存到config.json`);
    log.info(`📊 配置内容：${JSON.stringify(finalConfigArray, null, 2)}`);
} catch (e) {
    log.error(`❌ 保存配置失败：${e.message}`);
}

            // 输出最终结果
            log.info(`查找完成 - 角色：${targetName}，元素：${targetElement}，角色突破：${breakResult}，武器星级：${weaponStar}，武器突破：${weaponLevel}，天赋等级：${talentLevels}`);
            return true;
        };

        // 执行元素筛选
        const pureElement = targetElement.replace("元素", "").trim();
        log.info(`筛选元素：${pureElement}`);
        await selectElement(pureElement);
        // 遍历第一行角色
        log.info("遍历第一行角色...");
        const firstRowStartX = 618;
        const firstRowStartY = 175;
        const firstRowXStep = -129;
        const firstRowCols = 5;

        for (let col = 0; col < firstRowCols; col++) {
            const x = firstRowStartX + (col * firstRowXStep);
            targetFound = await checkCharacter(x, firstRowStartY);
            if (targetFound) break;
        }

        // 结果判定
        if (!targetFound) {
            log.warn(`未找到目标角色：${targetName}`);
            notification.warn(`未找到目标角色：${targetName}`);
        }

        // 返回主界面
    } catch (e) {
        log.error(`脚本执行异常：${e.message}`);
        notification.error(`脚本执行失败：${e.message}`);
    }
}
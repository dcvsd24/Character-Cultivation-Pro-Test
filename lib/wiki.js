/**
 * Wiki 数据获取模块
 * 从 bilibili wiki 获取角色培养材料信息
 */

var WikiFetcher = {
    WIKI_BASE_URL: "https://wiki.biligame.com/ys/",
    
    /**
     * 通用的HTTP请求函数（带延迟和重试机制）
     * @param {string} url - 请求URL
     * @param {string} description - 请求描述（用于日志和错误消息）
     * @param {string} errorType - 错误类型："character" 或 "weapon" 或 "material"（用于错误消息）
     * @returns {string|null} - HTML内容或null
     * @throws {Error} - 404状态码立即报错，超过最大重试次数时抛出错误
     */
    async fetchPage(url, description, errorType = null) {
        try {
            log.info(`📌 正在获取${description}...`);

            // 添加请求延迟，避免请求频率过高（状态码567）
            await sleep(5600);

            // 重试机制：最多重试5次，失败后等待1分钟再重试一轮，总共最多10次
            const maxRetries = 5;
            let response = null;
            let totalRetries = 0;
            const maxTotalRetries = 10;
            let lastStatusCode = 0;

            while (totalRetries < maxTotalRetries) {
                for (let retry = 0; retry < maxRetries && totalRetries < maxTotalRetries; retry++) {
                    totalRetries++;
                    response = await http.request("GET", url);
                    lastStatusCode = response.status_code;

                    if (response.status_code === 200) {
                        return response.body;
                    }

                    // 404 状态码表示页面不存在，立即报错
                    if (response.status_code === 404) {
                        const nameMatch = description.match(/【(.+)】/);
                        const name = nameMatch ? nameMatch[1] : description;
                        log.error(`❌ ${name}名字错误或不存在（状态码: 404）`);

                        if (errorType === "character") {
                            throw new Error(`${name}名字错误或角色不存在`);
                        } else if (errorType === "weapon") {
                            throw new Error(`${name}名称错误或武器不存在`);
                        } else if (errorType === "material") {
                            throw new Error(`${name}材料名称错误或不存在`);
                        } else {
                            throw new Error(`${name}名字错误或不存在`);
                        }
                    }

                    log.warn(`获取页面失败，状态码: ${response.status_code}，第 ${retry + 1} 次重试（总共第 ${totalRetries} 次）...`);

                    if (totalRetries >= maxTotalRetries) {
                        break;
                    }

                    if (retry < maxRetries - 1) {
                        await sleep(10000 + retry * 2000);
                    }
                }

                if (totalRetries >= maxTotalRetries) {
                    break;
                }

                log.warn(`已重试 ${maxRetries} 次全部失败，等待1分钟后继续重试...`);
                await sleep(60000);
            }

            // 超过最大重试次数，根据状态码抛出错误
            const nameMatch = description.match(/【(.+)】/);
            const name = nameMatch ? nameMatch[1] : description;

            if (errorType === "character") {
                throw new Error(`${name}获取失败（状态码: ${lastStatusCode}，已重试 ${totalRetries} 次）`);
            } else if (errorType === "weapon") {
                throw new Error(`${name}获取失败（状态码: ${lastStatusCode}，已重试 ${totalRetries} 次）`);
            } else if (errorType === "material") {
                throw new Error(`${name}材料获取失败（状态码: ${lastStatusCode}，已重试 ${totalRetries} 次）`);
            } else {
                throw new Error(`${name}获取失败（状态码: ${lastStatusCode}，已重试 ${totalRetries} 次）`);
            }
        } catch (e) {
            if (e.message.includes("名字错误") || e.message.includes("名称错误") || e.message.includes("不存在") || e.message.includes("获取失败")) {
                throw e;
            }
            log.error(`HTTP请求失败: ${e.message}`);
            throw new Error(`网络请求异常: ${e.message}`);
        }
    },
    
    /**
     * 根据用户输入的角色名称获取标准名称（从 combat_avatar.json）
     * @param {string} inputName - 用户输入的角色名称
     * @returns {string|null} - 标准角色名称或 null
     */
    getStandardCharacterName(inputName) {
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
            // 如果找不到标准名称，返回原始输入（可能 wiki 上有这个角色）
            return inputName.trim();
        } catch (e) {
            log.error(`读取 combat_avatar.json 失败: ${e.message}`);
            return inputName.trim();
        }
    },
    
    /**
     * 获取角色培养材料信息
     * @param {string} characterName - 角色名称（可以是别名，会自动转换为标准名称）
     * @returns {Object} - 包含 bossName, talentMobName, specialtyName, talentBookName
     */
    async getCharacterMaterials(characterName) {
        try {
            // 获取标准角色名称
            const standardName = this.getStandardCharacterName(characterName);
            if (!standardName) {
                log.error(`无法识别角色名称: ${characterName}`);
                return null;
            }
            
            const encodedName = encodeURIComponent(standardName);
            const characterUrl = this.WIKI_BASE_URL + encodedName;

            // 使用通用请求函数获取角色页面（传递 errorType 为 "character"）
            const html = await this.fetchPage(characterUrl, `角色【${standardName}】页面`, "character");
            if (!html) {
                return null;
            }
            
            // 调试：显示 HTML 内容长度
            log.info(`📌 获取到 HTML 内容，长度: ${html.length}`);
            
            // 解析角色页面获取材料名称
            const materialNames = this.parseCharacterPage(html);
            
            if (!materialNames) {
                log.error(`解析角色页面失败，未找到材料信息`);
                return null;
            }
            
            log.info(`📌 角色页面解析结果: Boss材料=${materialNames.bossMaterial}, 区域特产=${materialNames.specialty}, 天赋普通材料=${materialNames.talentMobMaterial}, 天赋书=${materialNames.talentBookRaw}`);
            
            // 获取 Boss 名称
            let bossName = null;
            if (materialNames.bossMaterial) {
                bossName = await this.getMaterialSource(materialNames.bossMaterial, "boss");
            }
            
            // 获取天赋怪物名称
            let talentMobName = null;
            if (materialNames.talentMobMaterial) {
                talentMobName = await this.getMaterialSource(materialNames.talentMobMaterial, "mob");
            }
            
            // 提取天赋书名称（「」内的文字）
            const talentBookName = this.extractTalentBookName(materialNames.talentBookRaw);
            
            const result = {
                bossName: bossName,
                talentMobName: talentMobName,
                specialtyName: materialNames.specialty,
                talentBookName: talentBookName
            };
            
            log.info(`✅ Wiki 数据获取完成: Boss=${bossName}, 天赋怪物=${talentMobName}, 区域特产=${materialNames.specialty}, 天赋书=${talentBookName}`);

            return result;
        } catch (e) {
            // 如果是我们抛出的错误，直接向上传递
            if (e.message.includes("名字错误") || e.message.includes("名称错误") || e.message.includes("不存在") || e.message.includes("获取失败")) {
                throw e;
            }
            log.error(`获取角色材料信息失败: ${e.message}`);
            throw new Error(`获取角色材料信息失败: ${e.message}`);
        }
    },
    
    /**
     * 解析角色页面获取材料名称
     * @param {string} html - HTML 内容
     * @returns {Object} - { bossMaterial, specialty, talentMobMaterial, talentBookRaw }
     */
    parseCharacterPage(html) {
        try {
            // 直接在整个HTML中搜索材料名称，基于关键词匹配
            // 使用 title 和 alt 属性
            
            log.info(`📌 开始解析HTML，搜索材料名称...`);
            
            // 解析 Boss 材料
            const bossMaterial = this.findBossMaterial(html);
            log.info(`📌 Boss材料匹配结果: ${bossMaterial}`);
            
            // 解析区域特产
            const specialty = this.findSpecialty(html);
            log.info(`📌 区域特产匹配结果: ${specialty}`);
            
            // 解析天赋普通材料
            const talentMobMaterial = this.findTalentMobMaterial(html);
            log.info(`📌 天赋普通材料匹配结果: ${talentMobMaterial}`);
            
            // 解析天赋书
            const talentBookRaw = this.findTalentBook(html);
            log.info(`📌 天赋书匹配结果: ${talentBookRaw}`);
            
            return {
                bossMaterial: bossMaterial,
                specialty: specialty,
                talentMobMaterial: talentMobMaterial,
                talentBookRaw: talentBookRaw
            };
        } catch (e) {
            log.error(`解析角色页面失败: ${e.message}`);
            return null;
        }
    },
    
    /**
     * 提取 HTML 中的某个区域
     * 改进：查找标题标签（h2/h3）后面的内容，而不是简单的文本搜索
     */
    extractSection(html, startMarker, endMarker) {
        // 尝试多种方式查找标题
        // 方式1: 查找 <h2 id="xxx"> 或 <h2>xxx</h2>
        let startIndex = -1;
        
        // 尝试匹配 <h2 id="突破"> 或 <h2>突破</h2>
        const h2Patterns = [
            new RegExp(`<h2[^>]*id="${startMarker}"[^>]*>`, 'gi'),
            new RegExp(`<h2[^>]*>${startMarker}</h2>`, 'gi'),
            new RegExp(`<h2[^>]*>${startMarker}`, 'gi')
        ];
        
        for (const pattern of h2Patterns) {
            const match = html.match(pattern);
            if (match) {
                startIndex = html.indexOf(match[0]);
                // 从标题结束位置开始
                startIndex = startIndex + match[0].length;
                break;
            }
        }
        
        // 如果没找到h2，尝试简单文本搜索（但跳过目录导航）
        if (startIndex === -1) {
            const simpleIndex = html.indexOf(startMarker);
            if (simpleIndex !== -1) {
                // 检查是否在目录导航中（toc）
                const beforeContent = html.substring(Math.max(0, simpleIndex - 100), simpleIndex);
                if (beforeContent.includes('toc') || beforeContent.includes('目录')) {
                    // 在目录中，跳过，查找下一个出现位置
                    const nextIndex = html.indexOf(startMarker, simpleIndex + startMarker.length);
                    if (nextIndex !== -1) {
                        startIndex = nextIndex;
                    }
                } else {
                    startIndex = simpleIndex;
                }
            }
        }
        
        if (startIndex === -1) return "";
        
        // 查找结束位置
        let endIndex = html.indexOf(endMarker, startIndex);
        if (endIndex === -1) {
            // 如果没找到结束标记，尝试查找下一个标题
            const nextTitleMatch = html.substring(startIndex).match(/<h2[^>]*>/gi);
            if (nextTitleMatch) {
                endIndex = startIndex + html.substring(startIndex).indexOf(nextTitleMatch[0]);
            } else {
                endIndex = startIndex + 5000; // 限制长度
            }
        }
        
        return html.substring(startIndex, endIndex);
    },
    
    /**
     * 查找 Boss 材料（数量为46的材料）
     */
    findBossMaterial(html) {
        // Boss材料数量固定为46
        // 网页结构：<div class="ys-iconLTop">46</div> ... <div class="ys-iconLBottom">...<font class="textBDHZ">材料名称</font>...</div>
        
        // 搜索数量46对应的材料名称
        // 方法：找到 ys-iconLTop 包含46的位置，然后在附近找 ys-iconLBottom 中的材料名称
        
        // 模式1: ys-iconLTop>46 后面紧跟 ys-iconLBottom
        const pattern1 = /ys-iconLTop[^>]*>46[^<]*<[^>]*>[^<]*<[^>]*ys-iconLBottom[^>]*>[^<]*<a[^>]*title="([^"]+)"[^>]*>/gi;
        const match1 = html.match(pattern1);
        if (match1) {
            log.info(`📌 Boss材料模式1匹配: ${match1[0]}`);
            const nameMatch = match1[0].match(/title="([^"]+)"/);
            if (nameMatch) {
                return nameMatch[1].trim();
            }
        }
        
        // 模式2: ys-iconLTop>46 后面找 textBDHZ
        const pattern2 = /ys-iconLTop[^>]*>46[^<]*<[^>]*>[\s\S]{0,200}textBDHZ[^>]*>([^<]+)<\/font>/gi;
        const match2 = html.match(pattern2);
        if (match2) {
            log.info(`📌 Boss材料模式2匹配: ${match2[0]}`);
            const nameMatch = match2[0].match(/textBDHZ[^>]*>([^<]+)<\/font>/);
            if (nameMatch) {
                return nameMatch[1].trim();
            }
        }
        
        // 模式3: 直接搜索 ys-iconLTop 包含46，然后找最近的 title
        const topPattern = /<div[^>]*class="ys-iconLTop"[^>]*>\s*46\s*<\/div>/gi;
        const topMatch = html.match(topPattern);
        if (topMatch) {
            const topIndex = html.indexOf(topMatch[0]);
            // 在后面200字符内找 ys-iconLBottom
            const nearbyContent = html.substring(topIndex, topIndex + 300);
            const bottomMatch = nearbyContent.match(/title="([^"]+)"[^>]*>/);
            if (bottomMatch) {
                return bottomMatch[1].trim();
            }
        }

        log.info(`📌 Boss材料未找到匹配`);
        return null;
    },
    
    /**
     * 查找区域特产（数量为168的材料）
     */
    findSpecialty(html) {
        // 区域特产数量固定为168
        
        // 模式1: ys-iconLTop>168 后面紧跟 ys-iconLBottom
        const pattern1 = /ys-iconLTop[^>]*>168[^<]*<[^>]*>[\s\S]{0,200}ys-iconLBottom[^>]*>[^<]*<a[^>]*title="([^"]+)"[^>]*>/gi;
        const match1 = html.match(pattern1);
        if (match1) {
            log.info(`📌 区域特产模式1匹配: ${match1[0]}`);
            const nameMatch = match1[0].match(/title="([^"]+)"/);
            if (nameMatch) {
                return nameMatch[1].trim();
            }
        }
        
        // 模式2: ys-iconLTop>168 后面找 textBDHZ
        const pattern2 = /ys-iconLTop[^>]*>168[^<]*<[^>]*>[\s\S]{0,200}textBDHZ[^>]*>([^<]+)<\/font>/gi;
        const match2 = html.match(pattern2);
        if (match2) {
            log.info(`📌 区域特产模式2匹配: ${match2[0]}`);
            const nameMatch = match2[0].match(/textBDHZ[^>]*>([^<]+)<\/font>/);
            if (nameMatch) {
                return nameMatch[1].trim();
            }
        }
        
        // 模式3: 直接搜索 ys-iconLTop 包含168，然后找最近的 title
        const topPattern = /<div[^>]*class="ys-iconLTop"[^>]*>\s*168\s*<\/div>/gi;
        const topMatch = html.match(topPattern);
        if (topMatch) {
            const topIndex = html.indexOf(topMatch[0]);
            const nearbyContent = html.substring(topIndex, topIndex + 300);
            const bottomMatch = nearbyContent.match(/title="([^"]+)"[^>]*>/);
            if (bottomMatch) {
                return bottomMatch[1].trim();
            }
        }

        log.info(`📌 区域特产未找到匹配`);
        return null;
    },
    
    /**
     * 查找天赋普通材料（数量为18/30/36的材料）
     */
    findTalentMobMaterial(html) {
        // 天赋普通材料数量：低级18、中级30、高级36
        // 优先匹配低级材料（数量18）
        
        // 搜索数量18对应的材料名称
        const topPattern18 = /<div[^>]*class="ys-iconLTop"[^>]*>\s*18\s*<\/div>/gi;
        const topMatch18 = html.match(topPattern18);
        if (topMatch18) {
            const topIndex = html.indexOf(topMatch18[0]);
            const nearbyContent = html.substring(topIndex, topIndex + 300);
            const bottomMatch = nearbyContent.match(/title="([^"]+)"[^>]*>/);
            if (bottomMatch) {
                return bottomMatch[1].trim();
            }
        }

        // 如果没找到18，尝试找30或36
        const fallbackCounts = [30, 36];
        for (const count of fallbackCounts) {
            const topPattern = new RegExp(`<div[^>]*class="ys-iconLTop"[^>]*>\\s*${count}\\s*<\/div>`, 'gi');
            const topMatch = html.match(topPattern);
            if (topMatch) {
                const topIndex = html.indexOf(topMatch[0]);
                const nearbyContent = html.substring(topIndex, topIndex + 300);
                const bottomMatch = nearbyContent.match(/title="([^"]+)"[^>]*>/);
                if (bottomMatch) {
                    return bottomMatch[1].trim();
                }
            }
        }

        log.info(`📌 天赋普通材料未找到匹配`);
        return null;
    },
    
    /**
     * 查找天赋书名称
     */
    findTalentBook(html) {
        // 天赋书格式：「乐园」的教导、「自由」的指引 等
        // 天赋书数量：教导9、指引63、哲学114
        // 使用数量9来定位天赋书名称
        
        // 定义数量16的正则表达式模式
        const topPattern16 = /<div[^>]*class="ys-iconLTop"[^>]*>\s*16\s*<\/div>/gi;
        
        // 搜索数量16对应的材料名称
        const topMatch16 = html.match(topPattern16);
        if (topMatch16) {
            const topIndex = html.indexOf(topMatch16[0]);
            const nearbyContent = html.substring(topIndex, topIndex + 300);
            // 匹配「」内的天赋书名称
            const bookMatch = nearbyContent.match(/title="「([^」]+)」[^"]*"/);
            if (bookMatch) {
                return bookMatch[1];
            }
            // 也可能没有「」符号
            const simpleMatch = nearbyContent.match(/title="([^"]+)的教导"/);
            if (simpleMatch) {
                return simpleMatch[1];
            }
        }

        // 如果没找到数量16，尝试找数量12或2
        const fallbackCounts = [12, 2];
        for (const count of fallbackCounts) {
            const topPattern = new RegExp(`<div[^>]*class="ys-iconLTop"[^>]*>\\s*${count}\\s*<\/div>`, 'gi');
            const topMatch = html.match(topPattern);
            if (topMatch) {
                const topIndex = html.indexOf(topMatch[0]);
                // 搜索数量${count}对应的材料名称
                // 提取数量${count}对应的材料名称
                const nearbyContent = html.substring(topIndex, topIndex + 300);
                // 匹配「」内的天赋书名称
                const bookMatch = nearbyContent.match(/title="「([^」]+)」[^"]*"/);
                if (bookMatch) {
                    return bookMatch[1];
                }
                // 也可能没有「」符号
                const simpleMatch = nearbyContent.match(/title="([^"]+)的(指引|哲学)"/);
                if (simpleMatch) {
                    return simpleMatch[1];
                }
            }
        }

        log.info(`📌 天赋书未找到匹配`);
        return null;
    },
    
    /**
     * 提取天赋书名称（「」内的文字）
     */
    extractTalentBookName(talentBookRaw) {
        if (!talentBookRaw) return null;
        
        // 已经是提取后的名称，直接返回
        return talentBookRaw;
    },
    
    /**
     * 获取材料的来源信息
     * @param {string} materialName - 材料名称
     * @param {string} type - 类型: "boss" 或 "mob" 或 "weaponMob"
     * @returns {string} - Boss名称或怪物名称
     * @throws {Error} - 当获取失败时抛出错误
     */
    async getMaterialSource(materialName, type) {
        try {
            const encodedName = encodeURIComponent(materialName);
            const materialUrl = this.WIKI_BASE_URL + encodedName;

            // 使用通用请求函数获取材料页面（传递 errorType 为 "material"）
            const html = await this.fetchPage(materialUrl, `材料【${materialName}】页面`, "material");
            if (!html) {
                return null;
            }

            // 查找"来源"部分
            const sourceSection = this.extractSourceSection(html);

            if (type === "boss") {
                return this.extractBossName(sourceSection);
            } else if (type === "mob" || type === "weaponMob") {
                return this.extractMobName(sourceSection);
            }

            return null;
        } catch (e) {
            // 如果是我们抛出的错误，直接向上传递
            if (e.message.includes("名字错误") || e.message.includes("名称错误") || e.message.includes("不存在") || e.message.includes("获取失败")) {
                throw e;
            }
            log.error(`获取材料来源失败: ${e.message}`);
            throw new Error(`获取材料【${materialName}】来源失败: ${e.message}`);
        }
    },
    
    /**
     * 提取来源部分
     */
    extractSourceSection(html) {
        // 查找"来源"标题后的内容
        // 网页结构：<tr><th>来源</th><td>...</td></tr>

        log.info(`📌 开始提取来源部分...`);

        // 模式1: <th>来源</th> 后面紧跟 <td>...</td>
        // 注意：th 和 td 之间可能有换行和空格
        const pattern1 = /<th[^>]*>\s*来源\s*<\/th>\s*<td[^>]*>([\s\S]{0,500})<\/td>/gi;
        const match1 = html.match(pattern1);
        if (match1) {
            return match1[0];
        }

        // 模式2: <tr><th>来源</th>...<td>...</td></tr>
        // 查找包含"来源"的 th 标签，然后找同一行的 td 标签
        const pattern2 = /<tr[^>]*>[\s\S]*?<th[^>]*>\s*来源\s*<\/th>[\s\S]*?<td[^>]*>([\s\S]{0,500})<\/td>[\s\S]*?<\/tr>/gi;
        const match2 = html.match(pattern2);
        if (match2) {
            return match2[0];
        }

        // 模式3: 查找包含"掉落"的内容（作为备用）
        const pattern3 = /(怪物掉落[\s\S]{0,300}|精英怪物掉落[\s\S]{0,300}|普通怪物掉落[\s\S]{0,300}|BOSS掉落[\s\S]{0,300})/gi;
        const match3 = html.match(pattern3);
        if (match3) {
            return match3[0];
        }

        log.info(`📌 来源部分未找到匹配`);
        return "";
    },
    
    /**
     * 从来源部分提取 Boss 名称
     */
    extractBossName(section) {
        // Boss材料来源格式：
        // <b>BOSS掉落</b><br>"30级以上"<a title="秘源机兵·构型械">秘源机兵·构型械</a>"掉落"

        // 查找 Boss 名称链接（在 BOSS掉落 后面）
        // 先找到 BOSS掉落 的位置，然后在附近找 <a> 标签
        const bossDropIndex = section.indexOf("BOSS掉落");
        if (bossDropIndex !== -1) {
            const afterBossDrop = section.substring(bossDropIndex, bossDropIndex + 300);

            // 匹配 <a title="Boss名称"> 或 <a ...>Boss名称</a>
            const linkMatch = afterBossDrop.match(/<a[^>]*title="([^"]+)"[^>]*>/gi);
            if (linkMatch) {
                const nameMatch = linkMatch[0].match(/title="([^"]+)"/);
                if (nameMatch) {
                    return nameMatch[1].trim();
                }
            }

            // 匹配 <a ...>Boss名称</a>
            const textMatch = afterBossDrop.match(/<a[^>]*>([^<]+)<\/a>/gi);
            if (textMatch) {
                return textMatch[0].match(/>([^<]+)<\/a>/)[1].trim();
            }
        }

        // 直接查找 <a> 标签中的 Boss 名称
        const linkPattern = /<a[^>]*title="([^"]+)"[^>]*>/gi;
        const linkMatch = section.match(linkPattern);
        if (linkMatch) {
            for (const match of linkMatch) {
                const nameMatch = match.match(/title="([^"]+)"/);
                if (nameMatch) {
                    return nameMatch[1].trim();
                }
            }
        }

        return null;
    },
    
    /**
     * 获取武器星级信息
     * @param {string} weaponName - 武器名称
     * @returns {string} - 武器星级（如"四星"、"五星"等）
     */
    async getWeaponStar(weaponName) {
        try {
            if (!weaponName) {
                log.error("武器名称为空，无法获取星级");
                return null;
            }
            
            const encodedName = encodeURIComponent(weaponName);
            const weaponUrl = this.WIKI_BASE_URL + encodedName;

            // 使用通用请求函数获取武器页面（传递 errorType 为 "weapon"）
            const html = await this.fetchPage(weaponUrl, `武器【${weaponName}】页面`, "weapon");
            if (!html) {
                return null;
            }

            // 解析武器页面获取星级
            const starLevel = this.parseWeaponStar(html);

            if (starLevel) {
                log.info(`✅ 武器【${weaponName}】星级: ${starLevel}`);
                return starLevel;
            } else {
                log.error(`解析武器页面失败，未找到星级信息`);
                return null;
            }
        } catch (e) {
            // 如果是我们抛出的错误，直接向上传递
            if (e.message.includes("名字错误") || e.message.includes("名称错误") || e.message.includes("不存在") || e.message.includes("获取失败")) {
                throw e;
            }
            log.error(`获取武器星级信息失败: ${e.message}`);
            throw new Error(`获取武器星级信息失败: ${e.message}`);
        }
    },
    
    /**
     * 获取武器材料信息
     * @param {string} weaponName - 武器名称
     * @returns {Object} - 包含 weaponDomainName, weapons1MobName, weapons2MobName
     */
    async getWeaponMaterials(weaponName) {
        try {
            if (!weaponName) {
                log.error("武器名称为空，无法获取材料信息");
                return null;
            }

            const encodedName = encodeURIComponent(weaponName);
            const weaponUrl = this.WIKI_BASE_URL + encodedName;

            // 使用通用请求函数获取武器页面（传递 errorType 为 "weapon"）
            const html = await this.fetchPage(weaponUrl, `武器【${weaponName}】页面（材料）`, "weapon");
            if (!html) {
                return null;
            }

            // 解析武器页面获取材料名称
            const materialNames = this.parseWeaponMaterials(html);

            if (!materialNames) {
                log.error(`解析武器页面失败，未找到材料信息`);
                return null;
            }

            log.info(`📌 武器页面解析结果: 秘境材料=${materialNames.weaponDomainMaterial}, 武器魔物材料1=${materialNames.weapons1Material}, 武器魔物材料2=${materialNames.weapons2Material}`);
            
            // 提取武器秘境名称（前四个字）
            let weaponDomainName = null;
            if (materialNames.weaponDomainMaterial) {
                weaponDomainName = materialNames.weaponDomainMaterial.substring(0, 4);
                log.info(`📌 武器秘境名称（前四个字）: ${weaponDomainName}`);
            }
            
            // 获取第一种武器魔物名称
            let weapons1MobName = null;
            if (materialNames.weapons1Material) {
                weapons1MobName = await this.getMaterialSource(materialNames.weapons1Material, "weaponMob");
                // 清理魔物名称
                if (weapons1MobName) {
                    weapons1MobName = this.cleanMobName(weapons1MobName);
                }
            }
            
            // 获取第二种武器魔物名称
            let weapons2MobName = null;
            if (materialNames.weapons2Material) {
                weapons2MobName = await this.getMaterialSource(materialNames.weapons2Material, "weaponMob");
                // 清理魔物名称
                if (weapons2MobName) {
                    weapons2MobName = this.cleanMobName(weapons2MobName);
                }
            }
            
            const result = {
                weaponDomainName: weaponDomainName,
                weapons1MobName: weapons1MobName,
                weapons2MobName: weapons2MobName
            };
            
            log.info(`✅ 武器材料获取完成: 秘境=${weaponDomainName}, 武器魔物1=${weapons1MobName}, 武器魔物2=${weapons2MobName}`);

            return result;
        } catch (e) {
            // 如果是我们抛出的错误，直接向上传递
            if (e.message.includes("名字错误") || e.message.includes("名称错误") || e.message.includes("不存在") || e.message.includes("获取失败")) {
                throw e;
            }
            log.error(`获取武器材料信息失败: ${e.message}`);
            throw new Error(`获取武器材料信息失败: ${e.message}`);
        }
    },
    
    /**
     * 解析武器页面获取材料名称
     * @param {string} html - HTML 内容
     * @returns {Object} - { weaponDomainMaterial, weapons1Material, weapons2Material }
     */
    parseWeaponMaterials(html) {
        try {
            log.info(`📌 开始解析武器页面，搜索材料名称...`);
            
            // 解析思路：
            // 1. 找到 "20级" 和 "突破" 的位置
            // 2. 在 "突破" 后面依次提取三个 title 属性
            // 3. 这三个 title 依次是：武器秘境名称、第一种武器魔物材料名称、第二种武器魔物材料名称
            
            // 查找 20级 的位置
            const level20Pattern = /<big><b>20级<\/b><\/big>/gi;
            const level20Match = html.match(level20Pattern);
            
            if (!level20Match) {
                log.error(`📌 未找到 "20级" 标记`);
                return null;
            }
            
            const level20Index = html.indexOf(level20Match[0]);
            log.info(`📌 找到 "20级" 位置: ${level20Index}`);
            
            // 在 20级 后面查找 "突破"
            const afterLevel20 = html.substring(level20Index, level20Index + 3000);
            const breakthroughPattern = /突破/gi;
            const breakthroughMatch = afterLevel20.match(breakthroughPattern);
            
            if (!breakthroughMatch) {
                log.error(`📌 未找到 "突破" 标记`);
                return null;
            }
            
            // 找到 "突破" 在 afterLevel20 中的位置
            const breakthroughIndex = afterLevel20.indexOf(breakthroughMatch[0]);

            // 在 "突破" 后面提取三个 title 属性
            const afterBreakthrough = afterLevel20.substring(breakthroughIndex);

            // 提取所有 title 属性
            const titlePattern = /title="([^"]+)"/gi;
            const titleMatches = [];
            let match;

            // 使用 exec 循环提取所有匹配
            while ((match = titlePattern.exec(afterBreakthrough)) !== null) {
                titleMatches.push(match[1]);
            }

            log.info(`📌 找到 ${titleMatches.length} 个 title 属性: ${titleMatches.join(', ')}`);
            
            // 需要至少 3 个 title
            if (titleMatches.length < 3) {
                log.error(`📌 title 属性数量不足，需要至少 3 个`);
                return null;
            }
            
            // 第一个 title 是武器秘境材料名称
            // 第二个 title 是第一种武器魔物材料名称
            // 第三个 title 是第二种武器魔物材料名称
            const weaponDomainMaterial = titleMatches[0];
            const weapons1Material = titleMatches[1];
            const weapons2Material = titleMatches[2];
            
            log.info(`📌 解析结果: 秘境材料=${weaponDomainMaterial}, 武器魔物材料1=${weapons1Material}, 武器魔物材料2=${weapons2Material}`);
            
            return {
                weaponDomainMaterial: weaponDomainMaterial,
                weapons1Material: weapons1Material,
                weapons2Material: weapons2Material
            };
        } catch (e) {
            log.error(`解析武器材料失败: ${e.message}`);
            return null;
        }
    },
    
    /**
     * 清理魔物名称
     * @param {string} name - 原始魔物名称
     * @returns {string} - 清理后的魔物名称
     */
    cleanMobName(name) {
        if (!name) return null;

        // 去掉 "xx级以上"、"掉落"、"星尘兑换"、"合成获得" 等文字
        let cleaned = name;

        // 去掉数字+级以上
        cleaned = cleaned.replace(/\d+级以上/g, '');

        // 去掉 "掉落"
        cleaned = cleaned.replace(/掉落/g, '');

        // 去掉 "星尘兑换"
        cleaned = cleaned.replace(/星尘兑换/g, '');

        // 去掉 "合成获得"
        cleaned = cleaned.replace(/合成获得/g, '');

        // 去掉引号
        cleaned = cleaned.replace(/"/g, '');

        // 去掉多余空格
        cleaned = cleaned.trim();

        log.info(`📌 清理魔物名称: ${name} -> ${cleaned}`);

        return cleaned;
    },
    
    /**
     * 解析武器页面获取星级
     * @param {string} html - HTML 内容
     * @returns {string} - 武器星级（如"四星"、"五星"等）
     */
    parseWeaponStar(html) {
        try {
            // 武器星级格式：<div style="color:#FFAF52;font-size:x-large;">★★★★</div>
            // 星星数量代表星级
            
            // 匹配包含星星的 div 标签
            const starPattern = /<div[^>]*style="[^"]*color:\s*#FFAF52[^"]*"[^>]*>([^<]+)<\/div>/gi;
            const match = html.match(starPattern);
            
            if (match) {
                log.info(`📌 找到星级匹配: ${match[0]}`);
                // 提取星星数量
                const starContent = match[0].replace(/<[^>]+>/g, '').trim();
                const starCount = (starContent.match(/★/g) || []).length;
                
                log.info(`📌 星星数量: ${starCount}`);
                
                // 根据星星数量返回对应的中文名称
                const starNames = {
                    1: "一星",
                    2: "二星",
                    3: "三星",
                    4: "四星",
                    5: "五星"
                };
                
                return starNames[starCount] || null;
            }
            
            // 备用匹配模式：查找 font-size:x-large 或类似样式
            const altPattern = /<div[^>]*font-size:\s*x-large[^>]*>([^<]+)<\/div>/gi;
            const altMatch = html.match(altPattern);
            
            if (altMatch) {
                log.info(`📌 备用星级匹配: ${altMatch[0]}`);
                const starContent = altMatch[0].replace(/<[^>]+>/g, '').trim();
                const starCount = (starContent.match(/★/g) || []).length;
                
                log.info(`📌 备用星星数量: ${starCount}`);
                
                const starNames = {
                    1: "一星",
                    2: "二星",
                    3: "三星",
                    4: "四星",
                    5: "五星"
                };
                
                return starNames[starCount] || null;
            }
            
            log.info(`📌 武器星级未找到匹配`);
            return null;
        } catch (e) {
            log.error(`解析武器星级失败: ${e.message}`);
            return null;
        }
    },
    
    /**
     * 从来源部分提取怪物名称
     */
    extractMobName(section) {
        // 怪物材料来源格式有多种：
        // 1. <b>精英怪物掉落</b><br><a href="..." title="深邃拟覆叶">深邃拟覆叶</a>掉落
        // 2. <b>普通怪物掉落</b><br>部族龙形武士掉落<br>星尘兑换
        // 3. <b>普通怪物掉落</b><br><b>合成获得</b><br>60级以上巡陆艇掉落
        // 4. 多个魔物：<b>普通怪物掉落</b><br />先遣队掉落<br />债务处理人少量掉落<br /><a title="雷萤术士">雷萤术士</a>少量掉落

        // 尝试匹配 "精英怪物掉落" 或 "普通怪物掉落"
        const dropTypes = ["精英怪物掉落", "普通怪物掉落", "怪物掉落"];

        for (const dropType of dropTypes) {
            const dropIndex = section.indexOf(dropType);
            if (dropIndex !== -1) {
                const afterDrop = section.substring(dropIndex, dropIndex + 400);

                // 收集所有魔物名称
                const mobNames = [];

                // 模式1: 提取所有 <a href="..." title="怪物名称"> 标签中的名称
                const linkPattern = /<a[^>]*title="([^"]+)"[^>]*>/gi;
                let linkMatch;
                while ((linkMatch = linkPattern.exec(afterDrop)) !== null) {
                    let name = linkMatch[1].trim();
                    // 过滤掉 "（页面不存在）" 等无用括号内容
                    name = name.replace(/\（[^）]*\）/g, "").trim();
                    name = name.replace(/\([^)]*\)/g, "").trim();
                    if (name.length > 2) {
                        log.info(`📌 从 <a> 标签提取怪物名称: ${name}`);
                        mobNames.push(name);
                    }
                }

                // 模式2: 提取所有 <br>怪物名称掉落 或 <br />怪物名称掉落
                const brPattern = /<br\s*\/?>\s*([^<]+)掉落/gi;
                let brMatch;
                while ((brMatch = brPattern.exec(afterDrop)) !== null) {
                    let name = brMatch[1].replace(/掉落/g, "").trim();
                    // 去掉 "xx级以上" 等前缀
                    name = name.replace(/\d+级以上/g, "").trim();
                    // 去掉 "少量" 等修饰词
                    name = name.replace(/少量/g, "").trim();
                    log.info(`📌 从 <br> 后提取怪物名称候选: ${name}`);

                    // 处理括号内的具体类型展开，如 "龙蜥（幼岩/岩/深海/深海幼）"
                    const bracketMatch = name.match(/^(.+?)\（([^）]+)\）$|^(.+?)\(([^)]+)\)$/);
                    if (bracketMatch) {
                        const baseName = bracketMatch[1] || bracketMatch[3];
                        const types = bracketMatch[2] || bracketMatch[4];
                        // 先添加基础名称
                        if (baseName.length > 2 && !mobNames.includes(baseName)) {
                            log.info(`📌 添加基础怪物名称: ${baseName}`);
                            mobNames.push(baseName);
                        }
                        // 分割括号内的类型（使用斜杠分隔）
                        const typeList = types.split(/[\/与]/).map(t => t.trim()).filter(t => t.length > 0);
                        for (const type of typeList) {
                            const fullName = type + baseName;
                            if (fullName.length > 2 && !mobNames.includes(fullName)) {
                                log.info(`📌 从括号展开提取怪物名称: ${fullName}`);
                                mobNames.push(fullName);
                            }
                        }
                    } else {
                        // 处理多种分隔符的情况：斜杠、与字
                        const splitNames = name.split(/[\/与]/).map(n => n.trim()).filter(n => n.length > 2);
                        if (splitNames.length > 1) {
                            for (const splitName of splitNames) {
                                if (!mobNames.includes(splitName)) {
                                    log.info(`📌 从分隔符分割提取怪物名称: ${splitName}`);
                                    mobNames.push(splitName);
                                }
                            }
                        } else if (name.length > 2 && !mobNames.includes(name)) {
                            mobNames.push(name);
                        }
                    }
                }

                // 如果找到了魔物名称，用逗号分隔返回
                if (mobNames.length > 0) {
                    const result = mobNames.join(", ");
                    log.info(`📌 最终提取怪物名称（多个）: ${result}`);
                    return result;
                }

                // 模式3: 直接从文本中提取（去掉HTML标签后）
                // 移除所有HTML标签，然后查找"掉落"前面的怪物名称
                const cleanText = afterDrop.replace(/<[^>]+>/g, "").trim();

                // 查找所有 "xxx掉落" 的模式
                const cleanPattern = /([\u4e00-\u9fa5]+)掉落/gi;
                let cleanMatch;
                while ((cleanMatch = cleanPattern.exec(cleanText)) !== null) {
                    let name = cleanMatch[1].replace(/掉落/g, "").trim();
                    // 去掉 "xx级以上" 等前缀
                    name = name.replace(/\d+级以上/g, "").trim();
                    // 去掉 "少量" 等修饰词
                    name = name.replace(/少量/g, "").trim();
                    log.info(`📌 从文本提取怪物名称候选: ${name}`);

                    // 处理括号内的具体类型展开，如 "龙蜥（幼岩/岩/深海/深海幼）"
                    const bracketMatch = name.match(/^(.+?)\（([^）]+)\）$|^(.+?)\(([^)]+)\)$/);
                    if (bracketMatch) {
                        const baseName = bracketMatch[1] || bracketMatch[3];
                        const types = bracketMatch[2] || bracketMatch[4];
                        // 先添加基础名称
                        if (baseName.length > 2 && !mobNames.includes(baseName)) {
                            log.info(`📌 添加基础怪物名称: ${baseName}`);
                            mobNames.push(baseName);
                        }
                        // 分割括号内的类型（使用斜杠分隔）
                        const typeList = types.split(/[\/与]/).map(t => t.trim()).filter(t => t.length > 0);
                        for (const type of typeList) {
                            const fullName = type + baseName;
                            if (fullName.length > 2 && !mobNames.includes(fullName)) {
                                log.info(`📌 从括号展开提取怪物名称: ${fullName}`);
                                mobNames.push(fullName);
                            }
                        }
                    } else {
                        // 处理多种分隔符的情况：斜杠、与字
                        const splitNames = name.split(/[\/与]/).map(n => n.trim()).filter(n => n.length > 2);
                        if (splitNames.length > 1) {
                            for (const splitName of splitNames) {
                                if (!mobNames.includes(splitName)) {
                                    log.info(`📌 从分隔符分割提取怪物名称: ${splitName}`);
                                    mobNames.push(splitName);
                                }
                            }
                        } else if (name.length > 2 && !mobNames.includes(name)) {
                            mobNames.push(name);
                        }
                    }
                }

                // 如果找到了魔物名称，用逗号分隔返回
                if (mobNames.length > 0) {
                    const result = mobNames.join(", ");
                    log.info(`📌 最终提取怪物名称（多个）: ${result}`);
                    return result;
                }
            }
        }

        log.info(`📌 怪物名称未找到匹配`);
        return null;
    }
};

// WikiFetcher 已定义为全局变量，无需额外导出（兼容 BetterGI 的 eval 加载方式）
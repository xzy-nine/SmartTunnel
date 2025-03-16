// ==UserScript==
// @name         SmartTunnel
// @namespace    http://tampermonkey.net/
// @version      0.4.4
// @description  根据网络环境自动选择访问站点（IPv6->A站点，内网->B站点）
// @author       You
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_info
// @connect      *
// @updateURL    https://raw.githubusercontent.com/xzy-nine/SmartTunnel/main/SmartTunnel.js
// @downloadURL  https://raw.githubusercontent.com/xzy-nine/SmartTunnel/main/SmartTunnel.js
// ==/UserScript==

(function() {
    'use strict';
    
    // 从存储中加载配置信息 
    let whitelist = GM_getValue('smarttunnel_whitelist', []);
    let intranetTestUrl = GM_getValue('smarttunnel_intranetTestUrl', 'http://intranet-test-resource/');
    let lastUpdateCheck = GM_getValue('smarttunnel_lastUpdateCheck', 0);
    let updateCheckInterval = GM_getValue('smarttunnel_updateCheckInterval', 86400000); // 默认24小时
    let autoUpdateEnabled = GM_getValue('smarttunnel_autoUpdateEnabled', false);
    
    // 检查当前网站是否在白名单中
    function checkWhitelist() {
        const currentDomain = window.location.hostname;
        return whitelist.find(site => currentDomain.includes(site.domain));
    }
    
    // 检查是否有IPv6连接
    function checkIPv6(callback) {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://ipv6.lookup.test-ipv6.com/ip/",
            timeout: 3000,
            onload: function(response) {
                // 如果能够加载这个IPv6测试站点，说明有IPv6连接
                if (response.status === 200 && response.responseText && !response.responseText.includes("No IPv6 address detected")) {
                    callback(true);
                } else {
                    callback(false);
                }
            },
            onerror: function() {
                callback(false);
            },
            ontimeout: function() {
                callback(false);
            }
        });
    }
    
    // 检查是否在内网环境
    function checkIntranet(callback) {
        // 使用配置的内网测试URL
        GM_xmlhttpRequest({
            method: "GET",
            url: intranetTestUrl,
            timeout: 2000,
            onload: function(response) {
                if (response.status === 200) {
                    callback(true);
                } else {
                    callback(false);
                }
            },
            onerror: function() {
                callback(false);
            },
            ontimeout: function() {
                callback(false);
            }
        });
    }
    
    // 添加网站到白名单
    function addToWhitelist() {
        const currentDomain = window.location.hostname;
        
        // 检查站点是否已经在白名单中
        if (whitelist.some(site => site.domain === currentDomain)) {
            alert(`站点 ${currentDomain} 已在白名单中！`);
            return;
        }
        
        // 获取用户输入的IPv6和内网站点URL
        const ipv6Site = prompt(`请输入${currentDomain}的IPv6站点URL:`, `https://ipv6.${currentDomain}`);
        if (!ipv6Site) return; // 用户取消
        
        const intranetSite = prompt(`请输入${currentDomain}的内网站点URL:`, `http://intranet.${currentDomain}`);
        if (!intranetSite) return; // 用户取消
        
        // 确保URL包含协议头
        const formatURL = (url) => {
            if (!/^(https?|ftp):\/\//i.test(url)) {
                return `http://${url}`;  // 默认添加http://
            }
            return url;
        };
        
        // 添加到白名单
        whitelist.push({
            domain: currentDomain,
            ipv6Site: formatURL(ipv6Site),
            intranetSite: formatURL(intranetSite)
        });
        
        // 保存白名单
        GM_setValue('smarttunnel_whitelist', whitelist);
        alert(`站点 ${currentDomain} 已添加到白名单！\n(已自动补全URL格式)`);
    }
    
    // 从白名单中移除当前站点
    function removeFromWhitelist() {
        const currentDomain = window.location.hostname;
        const initialLength = whitelist.length;
        
        // 过滤掉当前域名
        whitelist = whitelist.filter(site => !currentDomain.includes(site.domain));
        
        // 保存白名单
        GM_setValue('smarttunnel_whitelist', whitelist);
        
        if (initialLength > whitelist.length) {
            alert(`站点 ${currentDomain} 已从白名单中移除！`);
        } else {
            alert(`站点 ${currentDomain} 不在白名单中！`);
        }
    }
    
    // 显示当前白名单并提供删除功能
    function showWhitelist() {
        // 检查白名单是否为空
        if (whitelist.length === 0) {
            alert('白名单为空');
            return;
        }
        
        // 创建选项列表
        const options = whitelist.map((site, index) => 
            `${index + 1}. ${site.domain}\n   IPv6: ${site.ipv6Site}\n   内网: ${site.intranetSite}`
        );
        
        // 添加取消选项
        options.push('取消');
        
        // 构建提示信息
        const promptMessage = '当前白名单: (输入编号删除对应站点,或点击取消)\n\n' + 
                             options.join('\n');
        
        // 提示用户选择要删除的站点
        const selection = prompt(promptMessage, '');
        
        // 用户取消操作
        if (!selection) return;
        
        // 转换为数字并检查有效性
        const index = parseInt(selection) - 1;
        if (isNaN(index) || index < 0 || index >= whitelist.length) {
            alert('无效的选择');
            return;
        }
        
        // 获取选中的站点
        const site = whitelist[index];
        
        // 确认并执行删除
        if (confirm(`确定要删除 ${site.domain} 吗？`)) {
            whitelist.splice(index, 1);
            GM_setValue('smarttunnel_whitelist', whitelist);
            alert(`已删除 ${site.domain}`);
        }
    }
    
    // 配置内网检测URL
    function configureIntranetTest() {
        const newUrl = prompt('请输入用于检测内网环境的URL:', intranetTestUrl);
        if (!newUrl) return; // 用户取消
        
        intranetTestUrl = newUrl;
        GM_setValue('smarttunnel_intranetTestUrl', intranetTestUrl);
        alert('内网检测URL已更新！');
    }
    
    // 修复白名单中的URL格式
    function fixWhitelistURLs() {
        let fixed = 0;
        whitelist.forEach(site => {
            // 检查并修复IPv6站点URL
            if (!/^(https?|ftp):\/\//i.test(site.ipv6Site)) {
                site.ipv6Site = `http://${site.ipv6Site}`;
                fixed++;
            }
            
            // 检查并修复内网站点URL
            if (!/^(https?|ftp):\/\//i.test(site.intranetSite)) {
                site.intranetSite = `http://${site.intranetSite}`;
                fixed++;
            }
        });
        
        // 保存修复后的白名单
        GM_setValue('smarttunnel_whitelist', whitelist);
        alert(`白名单URL格式修复完成！\n修复了${fixed}个URL。`);
    }
    
    // 检查脚本更新
    function checkUpdate(showNoUpdateMsg = false) {
        const now = Date.now();
        // 如果没有强制检查且距离上次检查时间不足间隔时间，则跳过
        if (!showNoUpdateMsg && now - lastUpdateCheck < updateCheckInterval) {
            return;
        }
        
        // 记录本次检查时间
        GM_setValue('smarttunnel_lastUpdateCheck', now);
        
        // 获取当前版本
        const currentVersion = GM_info.script.version;
        
        // 使用 @updateURL 中定义的地址检查更新
        const updateUrl = GM_info.script.updateURL || "https://raw.githubusercontent.com/xzy-nine/SmartTunnel/main/SmartTunnel.js";
        
        GM_xmlhttpRequest({
            method: "GET",
            url: updateUrl,
            onload: function(response) {
                if (response.status === 200) {
                    // 提取最新脚本中的版本号
                    const versionMatch = response.responseText.match(/@version\s+([0-9.]+)/);
                    if (versionMatch && versionMatch[1]) {
                        const latestVersion = versionMatch[1];
                        
                        // 比较版本号
                        if (isNewerVersion(latestVersion, currentVersion)) {
                            // 显示更新提示
                            const updateMessage = `有新版本 ${latestVersion} 可用 (当前版本: ${currentVersion})`;
                            
                            // 下载链接
                            const downloadUrl = GM_info.script.downloadURL || 
                                "https://github.com/xzy-nine/SmartTunnel/raw/main/SmartTunnel.js";
                                
                            if (autoUpdateEnabled) {
                                // 如果启用了自动更新，提示用户并提供直接链接
                                GM_notification({
                                    title: 'SmartTunnel 更新可用',
                                    text: `${updateMessage}，点击此处安装更新`,
                                    onclick: function() {
                                        window.open(downloadUrl, '_blank');
                                    }
                                });
                            } else {
                                // 如果没有启用自动更新，只提示有更新可用
                                GM_notification({
                                    title: 'SmartTunnel 更新可用',
                                    text: `${updateMessage}，点击此处查看更新`,
                                    onclick: function() {
                                        window.open(downloadUrl, '_blank');
                                    }
                                });
                            }
                        } else if (showNoUpdateMsg) {
                            // 仅在手动检查时显示"已是最新"提示
                            GM_notification({
                                title: 'SmartTunnel 更新检查',
                                text: `当前版本 (${currentVersion}) 已是最新版本`,
                                timeout: 3000,
                                onclick: function() {
                                    window.open('https://github.com/xzy-nine/SmartTunnel', '_blank');
                                }
                            });
                        }
                    }
                }
            },
            onerror: function() {
                if (showNoUpdateMsg) {
                    GM_notification({
                        title: 'SmartTunnel',
                        text: '检查更新失败，请检查网络连接。'
                    });
                }
            }
        });
    }
    
    // 添加在检查更新函数后面

    // 自动更新脚本
    function autoUpdate() {
        const currentVersion = GM_info.script.version;
        const updateUrl = GM_info.script.updateURL || "https://raw.githubusercontent.com/xzy-nine/SmartTunnel/main/SmartTunnel.js";
        
        GM_xmlhttpRequest({
            method: "GET",
            url: updateUrl,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        // 提取最新脚本中的版本号
                        const versionMatch = response.responseText.match(/@version\s+([0-9.]+)/);
                        if (versionMatch && versionMatch[1]) {
                            const latestVersion = versionMatch[1];
                            
                            // 比较版本号
                            if (isNewerVersion(latestVersion, currentVersion)) {
                                // 创建一个临时脚本元素来安装更新
                                const script = document.createElement('script');
                                script.textContent = response.responseText;
                                script.setAttribute('data-autoinstall', true);
                                document.body.appendChild(script);
                                
                                GM_notification({
                                    title: 'SmartTunnel 自动更新',
                                    text: `正在从版本 ${currentVersion} 更新到 ${latestVersion}`,
                                    timeout: 3000
                                });
                            }
                        }
                    } catch (e) {
                        console.error('SmartTunnel 自动更新出错:', e);
                    }
                }
            }
        });
    }
    
    // 比较版本号，如果v2比v1新则返回true
    function isNewerVersion(v2, v1) {
        const v1parts = v1.split('.').map(Number);
        const v2parts = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const part1 = i < v1parts.length ? v1parts[i] : 0;
            const part2 = i < v2parts.length ? v2parts[i] : 0;
            
            if (part1 < part2) {
                return true;  // v2 更新
            } else if (part1 > part2) {
                return false; // v1 更新
            }
        }
        
        return false; // 版本相同
    }
    
    // 设置更新检查间隔
    function setUpdateInterval() {
        const currentInterval = updateCheckInterval / 86400000; // 转换为天数
        const newDays = prompt(`设置检查更新的时间间隔（天数）:`, currentInterval);
        
        if (newDays === null) return; // 用户取消
        
        const days = parseFloat(newDays);
        if (isNaN(days) || days < 0) {
            alert('请输入有效的天数！');
            return;
        }
        
        updateCheckInterval = days * 86400000;
        GM_setValue('smarttunnel_updateCheckInterval', updateCheckInterval);
        alert(`更新检查间隔已设置为 ${days} 天`);
    }
    
    // 切换自动更新功能
    function toggleAutoUpdate() {
        autoUpdateEnabled = !autoUpdateEnabled;
        GM_setValue('smarttunnel_autoUpdateEnabled', autoUpdateEnabled);
        alert(`自动更新功能已${autoUpdateEnabled ? '启用' : '禁用'}`);
        alert(autoUpdateEnabled ? '启用后，将在检测到新版本时提示您安装更新' : '禁用后，您需要手动检查和安装更新');
    }
    
    // 修改main函数

    function main() {
        const whitelistSite = checkWhitelist();
        
        // 检查更新
        checkUpdate();
        
        // 如果启用了自动更新，尝试自动更新
        if (autoUpdateEnabled) {
            autoUpdate();
        }
        
        if (whitelistSite) {
            // 如果当前网站在白名单中，检查网络环境
            // 先检查是否在内网
            checkIntranet(function(isIntranet) {
                if (isIntranet) {
                    console.log('检测到内网环境，跳转到B站点');
                    window.location.href = whitelistSite.intranetSite;
                } else {
                    // 不是内网，检查是否有IPv6
                    checkIPv6(function(hasIPv6) {
                        if (hasIPv6) {
                            console.log('检测到IPv6连接，跳转到A站点');
                            window.location.href = whitelistSite.ipv6Site;
                        } else {
                            console.log('既不是内网环境也不是IPv6环境，保持当前页面');
                        }
                    });
                }
            });
        } else {
            console.log('当前网站不在白名单中，不执行跳转');
        }
    }
    
    // 注册油猴菜单命令
    GM_registerMenuCommand("➕ 添加当前站点到白名单", addToWhitelist);
    GM_registerMenuCommand("➖ 从白名单中移除当前站点", removeFromWhitelist);
    GM_registerMenuCommand("📋 查看和管理白名单", showWhitelist);
    GM_registerMenuCommand("⚙️ 配置内网检测URL", configureIntranetTest);
    GM_registerMenuCommand("🛠️ 修复白名单URL格式", fixWhitelistURLs);
    GM_registerMenuCommand("🔄 检查更新", function() { checkUpdate(true); });
    GM_registerMenuCommand("⏱️ 设置更新检查间隔", setUpdateInterval);
    GM_registerMenuCommand(`${autoUpdateEnabled ? '✅' : '❌'} ${autoUpdateEnabled ? '启用' : '禁用'}自动更新`, toggleAutoUpdate);
    
    // 脚本启动
    main();
})();
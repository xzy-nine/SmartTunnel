// ==UserScript==
// @name         SmartTunnel
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  根据网络环境自动选择访问站点（IPv6->A站点，内网->B站点）
// @author       You
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      *
// ==/UserScript==

(function() {
    'use strict';
    
    // 从存储中加载配置信息
    let whitelist = GM_getValue('smarttunnel_whitelist', []);
    let intranetTestUrl = GM_getValue('smarttunnel_intranetTestUrl', 'http://intranet-test-resource/');
    
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
    
    // 主函数
    function main() {
        const whitelistSite = checkWhitelist();
        
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
    
    // 脚本启动
    main();
})();
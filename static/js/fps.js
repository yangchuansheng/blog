/*网站打开提醒代码开始*/
$(function(){
	if(/*getCookie('msg') !=*/ 1){
		var t = document.createElement("a");
	    t.href = document.referrer;
	    var msgTitle = t.hostname;
	    var name = t.hostname.split(".")[1];
	    if("" !== document.referrer){
	        switch (name) {
	            case 'bing':
	                msgTitle = '必应搜索';
	                break;
	            case 'baidu':
	                msgTitle = '百度搜索';
	                break;
	            case 'so':
	                msgTitle = '360搜索';
	                break;
	            case 'google':
	                msgTitle = '谷歌搜索';
	                break;
	            case 'sm':
	                msgTitle = '神马搜索';
	                break;
	            case 'sogou':
	                msgTitle = '搜狗搜索';
	                break;
	            default:
	                msgTitle =  t.hostname;
	        }
	    };
	    var time = (new Date).getHours();
	    var msg = '';
	    23 < time || time <= 5 ? msg = "你是夜猫子呀？这么晚还不睡觉，明天起的来嘛？":
	    5< time && time <= 7 ? msg = "早上好！一日之计在于晨，美好的一天就要开始了！":
	    7< time && time <= 11 ? msg = "上午好！工作顺利嘛，不要久坐，多起来走动走动哦！":
	    11< time && time <= 14 ? msg = "中午了，工作了一个上午，现在是午餐时间！":
	    14< time && time <= 17 ? msg = "午后很容易犯困呢，今天的运动目标完成了吗？":
	    17< time && time <= 19 ? msg = "傍晚了！窗外夕阳的景色很美丽呢，最美不过夕阳红~":
	    19< time && time <= 21 ? msg = "晚上好，今天过得怎么样？":
	    21< time && time <= 23 && (msg = "已经这么晚了呀，早点休息吧，晚安~");

        // 新增: 获取操作系统和浏览器信息的函数
        function getBrowserAndOS() {
            var userAgent = navigator.userAgent;
            var os = "Unknown OS";
            var browser = "Unknown Browser";

            // 检测操作系统
            if (userAgent.includes("Win")) os = "Windows";
            else if (userAgent.includes("Mac")) os = "macOS";
            else if (userAgent.includes("Linux") && !userAgent.includes("Android")) os = "Linux";
            else if (userAgent.includes("Android")) os = "Android";
            else if (userAgent.includes("like Mac") && userAgent.includes("iPhone")) os = "iPhone";
            else if (userAgent.includes("like Mac") && userAgent.includes("iPad")) os = "iPad";
            else if (userAgent.includes("X11") && !userAgent.includes("Linux")) os = "UNIX";

            // 检测浏览器
            if(userAgent.includes("Chrome") && !userAgent.includes("Edg")) browser = "Chrome";
            else if(userAgent.includes("Firefox")) browser = "Firefox";
            else if(userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari"; // Chrome的UA也包含"Safari"
            else if(userAgent.includes("MSIE") || userAgent.includes("Trident/")) browser = "Internet Explorer";
            else if(userAgent.includes("Edg")) browser = "Edge";

            return { os: os, browser: browser };
        }

		var browserAndOS = getBrowserAndOS();

        fetch("https://api.vvhan.com/api/getIpInfo")
            .then(response => response.json())
            .then(data => {
                window.info = data;
                layer.msg("Hi~ 来自"+ data.info.prov + "省" + data.info.city + '~<br/>通过 '+msgTitle+' 进来的朋友！<br/>使用 '+ browserAndOS.os + "<br/>"+ browserAndOS.browser + ' 访问本站！' + '<br/>' + msg);

                var showFPS = (function(){ 
                    var requestAnimationFrame =  
                        window.requestAnimationFrame || 
                        window.webkitRequestAnimationFrame || 
                        window.mozRequestAnimationFrame ||
                        window.oRequestAnimationFrame ||
                        window.msRequestAnimationFrame || 
                        function(callback) { 
                            window.setTimeout(callback, 1000/60); 
                        }; 
                    var e,pe,pid,fps,last,offset,step,appendFps; 
                 
                    fps = 0; 
                    last = Date.now(); 
                    step = function(){ 
                        offset = Date.now() - last; 
                        fps += 1; 
                        if( offset >= 1000 ){ 
                        last += offset; 
                        appendFps(fps); 
                        fps = 0; 
                        } 
                        requestAnimationFrame( step ); 
                    }; 
                    appendFps = function(fps){ 
                        var settings = {
                            timeout: 5000,
                            logError: true
                        }
                    };
                    step();
                })();
            })
            .catch(error => {
                console.error('Error:', error);
            });
	};
});
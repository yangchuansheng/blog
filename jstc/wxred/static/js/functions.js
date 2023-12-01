function insertAtCursor(myField, myValue) {
    //IE support
    if (document.selection) {
        myField.focus();
        sel = document.selection.createRange();
        sel.text = myValue;
        sel.select();
    }
    //MOZILLA/NETSCAPE support
    else if (myField.selectionStart || myField.selectionStart == '0') {
        var startPos = myField.selectionStart;
        var endPos = myField.selectionEnd;
        // save scrollTop before insert www.keleyi.com
        var restoreTop = myField.scrollTop;
        myField.value = myField.value.substring(0, startPos) + myValue + myField.value.substring(endPos, myField.value.length);
        if (restoreTop > 0) {
            myField.scrollTop = restoreTop;
        }
        myField.focus();
        myField.selectionStart = startPos + myValue.length;
        myField.selectionEnd = startPos + myValue.length;
    } else {
        myField.value += myValue;
        myField.focus();
    }
}

function index_in_array(value, array) {
    for (var i = 0; i < array.length; i++) {
        var v = array[i];
        if (v == value) {
            return i;
        }
    }
    return -1;
}

function replace_qq_emoji(str) {
    str = str.replace(/\[.*?\]/g, function (word) {
        var w = word.replace('[', '').replace(']', '');
        var index = index_in_array(w, qq_emoji);
        return '<img class="qq_emoji" src="/static/images/qq_emoji/Expression_' + (index + 1) + '@2x.png" />';
    });
    return str;
}

function set_water() {
    var water = $('#iphone .i-water');
    if (!water.length) {
        $('#iphone').append('<div class="i-water" id="waters"></div>');
    }
    $('.phone-wrap').css('transform', 'scale(0.5)');//同时设置比例
    $('.iphone').css('height', '1136px');//设置DIV高度
}

// 对Date的扩展，将 Date 转化为指定格式的String
// 月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符，
// 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字)
// 例子：
// (new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423
// (new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18
Date.prototype.format = function (fmt) { //author: meizz
    var o = {
        "M+": this.getMonth() + 1,                 //月份
        "d+": this.getDate(),                    //日
        "h+": this.getHours(),                   //小时
        "m+": this.getMinutes(),                 //分
        "s+": this.getSeconds(),                 //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "S": this.getMilliseconds()             //毫秒
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
};

function get_random_num(Min, Max) {
    var Range = Max - Min;
    var Rand = Math.random();
    return (Min + Math.round(Rand * Range));
}

function randomString(len, words) {
    len = len || 32;
    var $chars = '123456789';
    if (words) {
        $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    }
    var maxPos = $chars.length;
    var pwd = '';
    for (i = 0; i < len; i++) {
        pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
}

$(function(){
	$('.slt-common').change(function(){
		var val = $(this).find('option:selected').val();
		var _class = $(this).attr('data-class');
		$(this).find('option').each(function(i,item){
			$('.' + _class).removeClass($(item).val());
		});
		$('.' + _class).addClass(val);

		if(val=='i-n-user-group')
		{
			$(".input-common").val("群聊标题(3)");
			$('.i-n-name span').text("群聊标题(3)");
		}
		else if(val=='i-n-user-singal')
		{
			$(".input-common").val("单聊标题");
			$('.i-n-name span').text("单聊标题");
		}

	});
});
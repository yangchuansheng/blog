
var browser = {
  versions:function(){ 
  var u = navigator.userAgent, app = navigator.appVersion; 
  return {//移动终端浏览器版本信息 
    trident: u.indexOf("Trident") > -1, //IE内核
    presto: u.indexOf("Presto") > -1, //opera内核
    webKit: u.indexOf("AppleWebKit") > -1, //苹果、谷歌内核
    gecko: u.indexOf("Gecko") > -1 && u.indexOf("KHTML") == -1, //火狐内核
    mobile: !!u.match(/AppleWebKit.*Mobile.*/), //是否为移动终端
    ios: !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/), //ios终端
    android: u.indexOf("Android") > -1 || u.indexOf("Linux") > -1, //android终端或者uc浏览器
    iPhone: u.indexOf("iPhone") > -1 , //是否为iPhone或者QQHD浏览器
    iPad: u.indexOf("iPad") > -1, //是否iPad
    webApp: u.indexOf("Safari") == -1 //是否web应该程序，没有头部与底部
    };
  }(),
  language:(navigator.browserLanguage || navigator.language).toLowerCase()
} 

function getOs() { 
    var OsObject = ""; 
   if(isIE = navigator.userAgent.indexOf("MSIE")!=-1) { 
        return "MSIE"; 
   } 
   if(isFirefox=navigator.userAgent.indexOf("Firefox")!=-1){ 
        return "Firefox"; 
   } 
   if(isChrome=navigator.userAgent.indexOf("Chrome")!=-1){ 
        return "Chrome"; 
   } 
   if(isSafari=navigator.userAgent.indexOf("Safari")!=-1) { 
        return "Safari"; 
   }  
   if(isOpera=navigator.userAgent.indexOf("Opera")!=-1){ 
        return "Opera"; 
   } 
} 

function toDecimal2(x) {    
    var f = parseFloat(x);    
    if (isNaN(f)) {    
        return false;    
    }    
    var f = Math.round(x*100)/100;    
    var s = f.toString();    
    var rs = s.indexOf('.');    
    if (rs < 0) {    
        rs = s.length;    
        s += '.';    
    }    
    while (s.length <= rs + 2) {    
        s += '0';    
    }    
    return s;    
}    

Number.prototype.formatMoney = function (places, symbol, thousand, decimal) {
    places = !isNaN(places = Math.abs(places)) ? places : 2;
    symbol = symbol !== undefined ? symbol : "$";
    thousand = thousand || ",";
    decimal = decimal || ".";
    var number = this,
        negative = number < 0 ? "-" : "",
        i = parseInt(number = Math.abs(+number || 0).toFixed(places), 10) + "",
        j = (j = i.length) > 3 ? j % 3 : 0;
    return symbol + negative + (j ? i.substr(0, j) + thousand : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thousand) + (places ? decimal + Math.abs(number - i).toFixed(places).slice(2) : "");
};

$(function(){
	//初始化手机时间
    var now = new Date();
    var hours = now.getHours();
    var minutes = now.getMinutes();

    //qq表情
    $(qq_emoji).each(function(i,item){
      var a = '<a title="' + item + '" href="javascript:;"></a>';
      $('.faceBox').append(a);
    });

    //点击显示表情事件
    $('body').on('click','.btn-add-face',function(){
      var position = $(this).offset();
      var data_input = $(this).attr('data-input');
      $('#emojiPanel').css({
        //left:position.left,
        top:position.top + 55
      }).toggle();
      $('#emojiPanel').attr('data-input',data_input);
      return false;
    });

    //表情点击事件
    $('body').on('click','.emojiArea a',function(){
      var t = $(this).attr('title');
      var data_input = $(this).parents('#emojiPanel').attr('data-input');
      insertAtCursor($('.' + data_input).get(0),'[' + t + ']');
    });

    //初始时间
    for(var i = 0; i < 24; i++){
      var h = i > 9 ? i : '0' + i;
      var s = h == hours ? ' selected' : '';
      $('.slt-hour,.slt-p-hour').append('<option' + s + '>' + h + '</option>');
    }
    for(var i = 0; i < 60; i++){
      var h = i > 9 ? i : '0' + i;
      var s = h == minutes ? ' selected' : '';
      $('.slt-minite,.slt-p-minite').append('<option' + s + '>' + h + '</option>');
    }

    $('.slt-common').change(function(){
      var val = $(this).find('option:selected').val();
      var _class = $(this).attr('data-class');
      $(this).find('option').each(function(i,item){
        $('.' + _class).removeClass($(item).val());
      });
      $('.' + _class).addClass(val);
    });
      
    $('.rd-common').click(function(){
      var val = $(this).val();
      var _class = $(this).attr('data-class');
      if(val == '1'){
        $('.' + _class).show();
      }else{
        $('.' + _class).hide();
      }
    });

    $('.input-common').bind('input propertychange', function() {  
      var _class = $(this).attr('data-class');
      var val = $.trim($(this).val());
      $('.' + _class).text(val);
    });

    //手机时间选择
    $('.slt-phone-time').change(function(){
      var shi = $('.slt-p-shi option:selected').val();
      var hour = $('.slt-p-hour option:selected').val();
      var minite = $('.slt-p-minite option:selected').val();
      var str = '';

      if(shi != '-'){
        str += shi;
      }
      str += hour + ':';
      str += minite;

      $('.i-top-time').text(str);
    }).change();

    //点击body事件
    $('body').click(function(){
      $('#emojiPanel').hide();
    });

    $('body').on('click','.btn-rand-face',function(){
      var face_path = 'images/avatar/';
	  
      var num = get_random_num(1,40);
      var file_name = face_path + (num) + '.jpg';
      var img = '<img src="' + file_name + '" />';

      $(this).parents('.add-user').find('.a-u-pic-show img').remove();
      $(this).parents('.add-user').find('.a-u-pic-show input').after(img);

      var _class = $(this).attr('data-class');
        if(_class){
        var obj = $('.' + _class);
        if(obj.get(0).tagName.toLowerCase() == 'img'){
          obj.attr('src',file_name);
        }else{
          //obj.css('background-image','url("'+file_name+'")');
		  obj.html('<img src="'+file_name+'" />')
        }
      }
	  
	  $('.i-body-star-face1').html('<img src="'+file_name+'" />');
	  $('.i-body-star-face2').html('<img src="'+file_name+'" />');
	  $('.i-body-star-face3').html('<img src="'+file_name+'" />');
	  $('.i-body-star-face4').html('<img src="'+file_name+'" />');
	  
    });

    $('body').on('click','.btn-rand-username',function(){
      var num = get_random_num(4,8);
      var name = randomString(num,true);
      $(this).parents('.add-user').find('.a-u-data-name').val(name);
	  
	  //明星朋友圈所用代码
	 	  $('.i-body-star-name1').html(name);
		  $('.i-body-star-name2').html(name+':&nbsp;&nbsp;<span>怪我咯~</span>');
		  $('.i-body-star-name3').html(name+':&nbsp;&nbsp;<span>知道就好！</span>');
		  $('.i-body-star-name4').html('<span>'+name+'，&nbsp;&nbsp;决战夜你要加油！我们哎哟不错战队是<br />最屌的！</span>');
		  $('.i-body-star-name5').html(name+':&nbsp;&nbsp;<span>杰伦，决战夜小公举会来吗。~</span>');
		  $('.i-body-star-name6').html('周杰伦<span>回复</span>'+name+':&nbsp;&nbsp;<span>你拿冠军了，我让你当小<br />公举的小王纸。</span>');
		  $('.i-body-star-name7').html(name+':');
		  $('.i-body-star-name8').html(name+':&nbsp;&nbsp;<span>超哥，当初为什么要选我。</span>');
		  $('.i-body-star-name9').html('邓超<span>回复</span>'+name+':&nbsp;&nbsp;<span>你是我认识的人中，最<br />快的！</span>');
		  $('.i-body-star-name10').html(name+'，李晨，刘德华，郭富城，黎明...');
		  $('.i-body-star-name11').html(name+':&nbsp;&nbsp;<span>最近忙，就酱。</span>');
		  $('.i-body-star-name12').html(name+'，韩寒，郭敬明，叫兽易小星...');
		  $('.i-body-star-name13').html(name+':&nbsp;&nbsp;<span>哥，我有草原，可以放野（悍）马。</span>');
		  $('.i-body-star-name14').html('刘强东<span>回复</span>'+name+':&nbsp;&nbsp;<span>就你了，今晚交车。</span>');
		  $('.i-body-star-name15').html(name+':&nbsp;&nbsp;<span>金姐，求虐！</span>');
		  $('.i-body-star-name16').html('金星<span>回复</span>'+name+':&nbsp;&nbsp;<span>你呢，人长的挺好看，就是<br />偏偏要靠才华。</span>');
	  //明星朋友圈所用代码end
	  
	  
    });

    //电池滑块
    function setBar(num){
      $('.i-top-berry i em').css('width',num + '%');
      num = num.toString();
      var index = num.toString().lastIndexOf('.');
      num = index == -1 ? num : num.substring(0,index);
      $('.i-top-berry-num').text(num + '%');
    }
    $('.slider_bar').sGlide({
      'startAt': 50,
      'width': 300,
      'height': 20,
      'unit': 'px',
      // 'image': 'img/knob_.png',
      // 'pill': false,
      'totalRange': [1,100],
      // 'locked': true,
  
      'colorShift': ['#3a4d31', '#7bb560'],
      // 'vertical': true,
      'buttons': true,
      // 'disabled': true,
      drag: function(o){
        setBar(o.custom);
      },
      onButton: function(o){
        setBar(o.custom);
      }
    });


    if(is_check_brower && is_mobile == false && (getOs() != 'Chrome' && getOs() != 'Safari')){
    //if(is_check_brower){
      /*var browser = '<div class="browser"><a target="_blank" href="http://rj.baidu.com/soft/detail/14744.html"><span>o(︶︿︶)o 抱歉！您的浏览器不兼容，为了更好的制作效果，请用</span><i></i><em>谷歌浏览器</em><span>&nbsp;打开</span></a><a class="pop-close" href="#">x</a></div>';*/
	  /*var browser = '<div class="browser"><a target="_blank" href="http://rj.baidu.com/soft/detail/14744.html"><span><img src="APP/Tpl/images/1700124.jpg" width="40" height="40" style="border-radius:5px;" />&nbsp;&nbsp;微生成站长，QQ：1700124，提醒您：亲爱的用户，请用</span><i></i><em>谷歌浏览器</em><span>&nbsp;打开</span></a><a class="pop-close" href="#">x</a></div>';
      $('body').append(browser);
      $('body').append('<div class="mask"></div>');
      $('.mask').height($(document).height());*/
    }

    $('.pop-close').click(function(){
      $('.mask,.browser').hide();
      return false;
    });

    $('body').on('click','.my-image-continue',function(){
      $('.mask,.my-image').hide();
      return false;
    });
    
    
    
   
    
    
});


    
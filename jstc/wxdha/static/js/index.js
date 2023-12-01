     //消息数目
    var i_n_count = randomString(1);
    if(i_n_count > 0){
      $('.input-i-n-count').val(i_n_count);
      $('.i-n-count').text('(' + i_n_count + ')');
    }
    $('.input-i-n-count').bind('input propertychange', function() {
      var val = $(this).val();
      if(isNaN(val) || val == 0){
        $('.i-n-count').text('');
        return false;
      }
      val = '(' + $(this).val() + ')';
      $('.i-n-count').text(val);
    });
    $('.btn-del-i-n-count').click(function(){
      $('.i-n-count').text('');
      $('.input-i-n-count').val('');
      return false;
    });

    $('body').on('click','.a-u-dialog a',function(){
      var user = $(this).parents('.add-user');
      var index = user.index();
      var name = user.find('.a-u-name .a-u-data-name').val();
      var content = user.find('.a-u-name textarea').val();
      var img = $(this).parent().parent().find('.a-u-pic-show img').clone();
      var type = user.find('.a-u-dialog-master a').hasClass('btn-success');

      if(name == ''){
        alert('请输入用户名！');
        return false;
      }

      if(content == ''){
        alert('请输入聊天内容！');
        return false;
      }

      if(!img.length){
        img = '<img src="/APP/Tpl/images/make/default-head.png" />';
      }

      content = replace_qq_emoji(content);

      var msg_class = type ? 'i-b-sen-text' : 'i-b-rec-text';
      var nick = type ? '' : '<p class="i-b-nick">' + name + '</p>';

      var dialog = $('<div class="' + msg_class + '"><div>' + nick + '<span><i></i><em>' + content + '</em><a class="msg-del"></a></span></div></div>');
      dialog.prepend(img);
      $('.i-body').append(dialog);
      return false; 
    });

    $('.add-time-btn').click(function(){
      var xinqi = $('.slt-xinqi option:selected').val();
      var shi = $('.slt-shi option:selected').val();
      var hour = $('.slt-hour option:selected').val();
      var minite = $('.slt-minite option:selected').val();
      var str = '';
      if(xinqi != '-')
        str += xinqi + ' ';
      if(shi != '-')
        str += shi;
      str += hour + ':';
      str += minite;
      var html = '<div class="i-b-time"><span>' + str + '</span><a class="msg-del"></a></div>';
      $('.i-body').append(html);
      return false;
    });

    var set_body_bg = function(){
      var img = $('.a-u-pic-bodybg img');
      var src = img.attr('src');
	  /*判断是否设置了微信图片，如果设置了，自动屏蔽背景*/
	  if($('.wx_pic_diy').length == 0){
	  	$('.i-body').css('background-image','url(' + src + ')');
	  }else{
		alert('微信图片与微信背景暂时不兼容，关注本站，近期更新后将修复此问题！');
	  	$('.i-body').css('background','none');
	  }
      
      /*if(is_login){
        alert();
      }*/
    }
    
    
     

    $('body').on('change','.a-u-pic-show input',function() { 
      var img = document.createElement('img');//创建 img 对象
      var _this = $(this);
      var callback = _this.attr('data-callback');
  
      window.URL = window.URL || window.webkitURL;

      var imgFile = $(this).get(0);

      if(window.URL && imgFile.files[0]){
        var reader = new FileReader(); 
        reader.readAsDataURL(imgFile.files[0]); 
        reader.onload = function(e){ 
          var img = '<img src="'+this.result+'" alt=""/>'; 
          _this.parent().find('img').remove();
          _this.parent().append(img);

          if(callback){
            eval(callback + '()');
          }
        } 
      }
    });
	
	
	
	//2016-3-13 新增图片处理
	$('body').on('change','.a-u-pic-show-pic input',function() { 
      var img = document.createElement('img');//创建 img 对象
      var _this = $(this);
      var callback = _this.attr('data-callback');
  
      window.URL = window.URL || window.webkitURL;

      var imgFile = $(this).get(0);

      if(window.URL && imgFile.files[0]){
        var reader = new FileReader(); 
        reader.readAsDataURL(imgFile.files[0]); 
        reader.onload = function(e){ 
          var img = '<img src="'+this.result+'" alt=""/>'; 
          _this.parent().find('img').remove();
          _this.parent().append(img);

          if(callback){
            eval(callback + '()');
          }
        } 
      }
    });
	
	

    //添加用户
    $('#add-user').click(function(){

      var time = (new Date()).valueOf();
      var html = $('<div class="add-user"><div class="a-u-pic"><div class="a-u-pic-show"><input type="file" accept="image/jpeg,image/x-png" /></div></div><div class="a-u-name"><p><span>用户名：</span><input class="a-u-data-name" type="text" value="" /></p><p><span>聊天内容：</span><textarea class="a-u-content' + time + '"></textarea><a class="a-u-face btn-add-face" data-input="a-u-content' + time + '" href="#">表情</a></p><p><span>转账/收钱金额：</span><input class="a-u-data-pay" type="text" value="" /></p><p><span>语音时间：</span><input class="a-u-data-voice" type="text" value="" /></p><p><input style="margin-right:5px;" class="btn-rand-username" type="button" value="随机用户名" /><input class="btn-rand-face" type="button" value="随机头像" /></p><p><div class="a-u-pic-pic"><div class="a-u-pic-show-pic"><input type="file" class="a-u-data-pic" accept="image/jpeg,image/x-png"></div></div></p></div><div class="a-u-dialog" style="clear:both;"><a class="btn btn-primary" data-type="left" href="#">添加文字对话</a></div><div class="a-u-dialog-pic"><a class="btn btn-warning" data-type="left" href="#">添加图片对话</a></div><div class="a-u-dialog-voice"><a class="btn btn-primary" data-type="left" href="#">添加语音对话</a></div><div class="a-u-dialog-pay"><a class="btn btn-primary" data-dir="send" data-type="left" href="#">添加转账对话</a></div><div class="a-u-dialog-pay"><a class="btn btn-primary" data-dir="rec" data-type="left" href="#">添加收钱对话</a></div><div class="a-u-dialog-master"><a class="btn btn-primary" href="#">设为主人</a></div><div class="a-u-dialog-del"><a class="btn btn-danger" href="#">删除用户</a></div></div>');
      $('.users').append(html);
      html.find('.btn-rand-username').click();
    });

    //删除用户
    $('body').on('click','.a-u-dialog-del',function(){
      if(confirm('您确认要删除？')){
        $(this).parents('.add-user').remove();
      }
      return false;
    });

    /*$('body').on('mouseover','.i-b-time,.i-b-rec-text,.i-b-sen-text',function(){
      $(this).find('.msg-del').show();
    });
    $('body').on('mouseout','.i-b-time,.i-b-rec-text,.i-b-sen-text',function(){
      $(this).find('.msg-del').hide();
    });*/

    $('body').on('click','.msg-del',function(){
      $(this).parents('.i-b-time,.i-b-rec-text,.i-b-sen-text').remove();
    });

    $('.clear-dialog').click(function(){
      if(confirm('您确认要清除所有对话？')){
        $('.i-body').html('');
      }
    });

    //添加转账对话
    $('body').on('click','.a-u-dialog-pay a',function(){
      var dir = $(this).attr('data-dir');
      var user = $(this).parents('.add-user');
      var type = user.find('.a-u-dialog-master a').hasClass('btn-success');
      var index = user.index();
      var name = user.find('.a-u-name .a-u-data-name').val();
      var pay = user.find('.a-u-name .a-u-data-pay').val();
      var img = $(this).parent().parent().find('.a-u-pic-show img').clone();
      
      
     layer.prompt({title: '请输入收款方昵称', formType: 2}, function(text, index){
        layer.close(index);
        if(!text){
            layer.msg('必须填写收款方昵称！');
        }else{
            var nick_name = text;
            
            if(name == ''){
                alert('请输入用户名！');
                return false;
              }

              if(pay == ''){
                alert('请输入转账/收钱金额！');
                return false;
              }

              if(isNaN(pay)){
                alert('您输入的金额有误！');
                return false;
              }

              if(!img.length){
                img = '<img src="/APP/Tpl/images/make/default-head.png" />';
              }

              var wrap_class = !type ? 'i-b-rec-text' : 'i-b-sen-text';
              var pay_class = dir == 'send' ? 'i-pay-send' : 'i-pay-rec';
              var nick = type ? '' : '<p class="i-b-nick">' + name + '</p>';
              if(dir == 'send'){
                  var html = $('<div class="' + wrap_class + '"><div class="i-b-pay">' + nick + '<span class="' + pay_class + '"><i></i><em>' + toDecimal2(pay) + '</em><em class="nickname">转账给'+nick_name+'</em><a class="msg-del"></a></span></div></div>');
              }else{
                  var html = $('<div class="' + wrap_class + '"><div class="i-b-pay">' + nick + '<span class="' + pay_class + '"><i></i><em>' + toDecimal2(pay) + '</em><a class="msg-del"></a></span></div></div>');
              }
              
              
              html.prepend(img);
              $('.i-body').append(html);

              return false;
            
            
            
        }
     });

      
    });

    //添加语音对话
    $('body').on('click','.a-u-dialog-voice a',function(){
      var user = $(this).parents('.add-user');
      var name = user.find('.a-u-name .a-u-data-name').val();
      var img = $(this).parent().parent().find('.a-u-pic-show img').clone();
      var voice = user.find('.a-u-name .a-u-data-voice').val();
      var type = user.find('.a-u-dialog-master a').hasClass('btn-success');

      if(name == ''){
        alert('请输入用户名！');
        return false;
      }


      if(voice == ''){
        alert('请输入语音时间！');
        return false;
      }

      if(isNaN(voice)){
        alert('您输入的语音时间有误！');
        return false;
      }

      if(!img.length){
        img = '<img src="/APP/Tpl/images/make/default-head.png" />';
      }

      var wrap_class = !type ? 'i-b-rec-text' : 'i-b-sen-text';
      var nick = type ? '' : '<p class="i-b-nick">' + name + '</p>';

      var v_len = 0;
      var len = 0;
      v_len = voice > 60 ? 60 : voice;
      len = (360 - 96)/60 * v_len + 96;

      var unread = '';//type ? '' : '<strong></strong>';

      var html = $('<div class="' + wrap_class + '"><div class="i-b-voice">' + nick + '<span style="width:' + len + 'px"><i></i><b></b><em>' + voice + '\'\'</em>' + unread + '<a class="msg-del"></a></span></div></div>');

      html.prepend(img);
      $('.i-body').append(html);

      return false;
    });
	
	
	
	
	
	//添加图片对话
	var pic_i = 0;
    $('body').on('click','.a-u-dialog-pic a',function(){
	  $('.i-body').css('background','none');
      var user = $(this).parents('.add-user');
      var name = user.find('.a-u-name .a-u-data-name').val();
      var img = $(this).parent().parent().find('.a-u-pic-show img').clone();
      var pic = $(this).parent().parent().find('.a-u-pic-show-pic img').clone();
      var type = user.find('.a-u-dialog-master a').hasClass('btn-success');
	  pic_i = pic_i + 1;
      if(name == ''){
        alert('请输入用户名！');
        return false;
      }
	  
	  if(!pic.length){
        alert('您没有上传图片！');
        return false;
      }

      if(!img.length){
        img = '<img src="/APP/Tpl/images/make/default-head.png" />';
      }

      var wrap_class = !type ? 'i-b-rec-text' : 'i-b-sen-text';
      var nick = type ? '' : '<p class="i-b-nick">' + name + '</p>';
	  var pic_type = !type ? 'wx_pic_pos2' : 'wx_pic_pos';

      var unread = '';//type ? '' : '<strong></strong>';

      var html = $('<div class="' + wrap_class + '"><div class="i-b-voice">' + nick + '<span class="wx_pic_diy" id="s'+pic_i+'"><h6 class="' + pic_type + '"></h6><a class="msg-del"></a></span></div></div>');

	  html.prepend(img);

      $('.i-body').append(html);
	  
	  $('#s'+pic_i).prepend(pic);
	  

      return false;
    });
	

    //主人切换
    $('body').on('click','.a-u-dialog-master a',function(){
      var parent = $(this).parents('.users');
      parent.find('.a-u-dialog-master a').removeClass('btn-success');
      $(this).addClass('btn-success');
      return false;
    });

    $('.body_bg_del').click(function(){
      $('.i-body').css('background-image','none');
      $('.a-u-pic-bodybg img').remove();
      return false;
    });
    
    

    $('#add-user').click();

    setTimeout(function(){
      $('.btn-rand-face').click();
      $('.btn-rand-username').click();
    },500);
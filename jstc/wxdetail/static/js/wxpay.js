	var is_mobile = '';
    if(is_mobile == '1'){
      $('.i-w-pay-money').addClass('i-w-pay-money-mobile');
    }

    $('body').on('change','.a-u-pic-show input',function() { 
      var img = document.createElement('img');//创建 img 对象
      var _this = $(this);
  
      window.URL = window.URL || window.webkitURL;

      var imgFile = $(this).get(0);

      if(window.URL && imgFile.files[0]){
        var reader = new FileReader(); 
        reader.readAsDataURL(imgFile.files[0]); 
        reader.onload = function(e){ 
          var img = '<img src="'+this.result+'" alt=""/>'; 
          _this.parent().find('img').remove();
          _this.parent().append(img);
          $('.i-b-a-face').css('background-image','url(' + this.result + ')');
        } 
      }
    });

    $('.datepicker').datetimepicker({
        format: 'yyyy-mm-dd hh:ii:ss',
        language:"zh-CN",
        minView:2,
        autoclose:true,
        startDate:(new Date()),
        pickerPosition:'top-right'
    }).on('changeDate', function(ev){
      var _this = $(this);
      _this.keyup();
    });

    var time = (new Date()).format("yyyy-MM-dd hh:mm:ss");
    var time2 = (new Date(((new Date()).valueOf() + 5 * 60 *1000))).format("yyyy-MM-dd hh:mm:ss");
    $('.i-w-pay-sen-date').val(time);
    $('.i-w-pay-sen-time span').text(time);
    $('.i-w-pay-rec-date').val(time2);
    $('.i-w-pay-rec-time span').text(time2);

    //交易号
    function set_trade(){
      var rand = randomString(14);
      var head = (new Date()).format("yyyy-MM-dd hh:mm").split(' ')[0].replace('-','').replace('-','');
      var num = head + '00000000' + rand;
      $('.i-b-a-trade').text(num);      
    }
    set_trade();
    $('#btn-trade').click(function(){
      set_trade();
    });


    //类型
    $('.slt-type').change(function(){
      var type = $(this).find('option:selected').val();
      switch(type){
        case '1':{
          $('.i-b-a-plus').text('+').removeClass('i-b-a-mines');
          $('.i-body-alipay').removeClass('i-body-alipay2');
          $('.i-b-a-pay-type').hide();
        }break;
        case '2':{
          $('.i-b-a-plus').text('-').addClass('i-b-a-mines');
          $('.i-body-alipay').addClass('i-body-alipay2');
          $('.i-b-a-pay-type').show();
        }break;
      }
    });

    //随机生成邮箱
    function set_email(){
        var head = randomString(3,true);
        var foot = ['qq.com','163.com','yeah.net','sina.com','126.com','vip.sina.com','sina.cn','hotmail.com','gmail.com','sohu.com','139.com','wo.com.cn','189.com','21cn.com'];
        var rand_num = get_random_num(0,14);
        var email = head + '***' + '@' + foot[rand_num];
        $('.input-email').val(email);
        $('.i-b-a-email').text(email); 
    }
    set_email();
    $('#rand_email').click(function(){
      set_email();
    });
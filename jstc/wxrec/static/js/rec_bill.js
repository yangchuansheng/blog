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

$(function(){

    $('.datepicker').datetimepicker({
        format: 'yyyy-mm-dd hh:ii:ss',
        language:"zh-CN",
        minView:2,
        autoclose:true,
        //startDate:(new Date()),
        pickerPosition:'top-right'
    }).on('changeDate', function(ev){
        var _this = $(this);
        _this.keyup();
    });

    var time = (new Date()).format("yyyy-MM-dd hh:mm:ss");
    $('.datepicker').val(time);
    $('.i-zd-desc4 span').text(time);

    //交易号
    function set_trade(){
        var rand = randomString(10);
        var rand2 = randomString(3);
        var head = (new Date()).format("yyyy-MM-dd hh:mm").split(' ')[0].replace('-','').replace('-','');
        var num = '1000050101' + head + rand+ rand2;
        $('.i-zd-desc5 span').html(num);
        $('.input-trade').val(num);
    }
    set_trade();
    $('#btn-trade').click(function(){
        set_trade();
    });

    $('.pop-pic .tips a').click(function(){
        $('.pop-pic').hide();
        $('#wrapper').show();
    });
    $(".btn-rand-face").click();

});
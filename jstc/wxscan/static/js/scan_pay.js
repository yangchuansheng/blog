if(is_mobile == '1'){
    $('.i-w-pay-money').addClass('i-w-pay-money-mobile');
}


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
        // $('.i-zd-desc4 span').text(time);
    });

    var time = (new Date()).format("yyyy-MM-dd hh:mm:ss");
    $('.datepicker').val(time);
    $('.i-zd-desc4 span').text(time);

    //交易号
    function set_trade(){
        var rand = randomString(10);
        var rand2 = randomString(4);
        var head = (new Date()).format("yyyy-MM-dd hh:mm").split(' ')[0].replace('-','').replace('-','');
        var num = '1000107101' + head + rand + rand2;
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

});
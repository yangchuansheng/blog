var is_mobile = '';
    if(is_mobile == '1'){
      $('.i-w-pay-money').addClass('i-w-pay-money-mobile');
    }

$('body').on('change', '.a-u-pic-show input', function () {
    var img = document.createElement('img');//创建 img 对象
    var _this = $(this);
    var callback = _this.attr('data-callback');

    window.URL = window.URL || window.webkitURL;

    var imgFile = $(this).get(0);

    if (window.URL && imgFile.files[0]) {
        var reader = new FileReader();
        reader.readAsDataURL(imgFile.files[0]);
        reader.onload = function (e) {
            var img = '<img src="' + this.result + '" alt=""/>';
            $('#ppic').html(img);
            _this.parent().find('img').remove();
            _this.parent().append(img);

            if (callback) {
                eval(callback + '()');
            }
        }
    }
});

$('.datepicker').datetimepicker({
    format: 'yyyy-mm-dd hh:ii:ss',
    language: "zh-CN",
    minView: 2,
    autoclose: true,
    startDate: (new Date()),
    pickerPosition: 'top-right'
}).on('changeDate', function (ev) {
    var _this = $(this);
    _this.keyup();
});

var time = (new Date()).format("yyyy-MM-dd hh:mm:ss");
$('.i-w-pay-sen-date').val(time);
$('.i-w-pay-sen-time span').text(time);



//信息操作
$('#get_info').text($('#get_info_input').val());
$('#get_info_input').keyup(function(){
    $('#get_info').text($(this).val());
})

$('#get_time').text($('#get_time_input').val());
$('#get_time_input').change(function(){
    $('#get_time').text($(this).val());
})

$('#contact').text($('#contact_input').val());
$('#contact_input').keyup(function(){
    $('#contact').text($(this).val());
})

$('#mobile').text($('#mobile_input').val());
$('#mobile_input').keyup(function(){
    $('#mobile').text($(this).val());
})

$('#addr').text('收货地址：' + $('#addr_input').val());
$('#addr_input').keyup(function(){
    $('#addr').text($(this).val());
})

$('#shop').html($('#shop_input').val() + '&nbsp;&nbsp;<b>></b>');
$('#shop_input').keyup(function(){
    $('#shop').html($(this).val() + '&nbsp;&nbsp;<b>></b>');
})

$('#product').text($('#product_input').val());
$('#product_input').keyup(function(){
    $('#product').text($(this).val());
})

$('#price').text('￥' + parseInt($('#price_input').val()) + '.00');
$('#price_input').keyup(function(){
    $('#price').text('￥' + parseInt($(this).val()) + '.00');
})

$('#nprice').html('<s>￥' + parseInt($('#nprice_input').val()) + '.00</s>');
$('#nprice_input').keyup(function(){
    $('#nprice').html('<s>￥' + parseInt($(this).val()) + '.00</s>');
})

$('#pnum').text('x' + parseInt($('#pnum_input').val()));
$('#pnum_input').keyup(function(){
    $('#pnum').text('x' + parseInt($(this).val()));
})

$('#freight').text('￥' + parseInt($('#freight_input').val()) + '.00');
$('#freight_input').keyup(function(){
    $('#freight').text('￥' + parseInt($(this).val()) + '.00');
})

$('#bnum').text('￥' + parseInt($('#bnum_input').val()) + '.00');
$('#bnum_input').keyup(function(){
    $('#bnum').text('￥' + parseInt($(this).val()) + '.00');
})






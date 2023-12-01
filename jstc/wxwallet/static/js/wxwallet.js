var is_mobile = '';
if (is_mobile == '1') {
    $('.i-w-pay-money').addClass('i-w-pay-money-mobile');
}

$('body').on('change', '.a-u-pic-show input', function () {
    var img = document.createElement('img');//创建 img 对象
    var _this = $(this);

    window.URL = window.URL || window.webkitURL;

    var imgFile = $(this).get(0);

    if (window.URL && imgFile.files[0]) {
        var reader = new FileReader();
        reader.readAsDataURL(imgFile.files[0]);
        reader.onload = function (e) {
            var img = '<img src="' + this.result + '" alt=""/>';
            _this.parent().find('img').remove();
            _this.parent().append(img);
            $('.i-b-a-face').css('background-image', 'url(' + this.result + ')');
        }
    }
});

$('.i-w-wa-money-change').bind('input propertychange', function () {
    var value = $(this).val();
    if (!value || isNaN(value))
        return false;
    value = toDecimal2(value);
    $('.i-w-wa-money span').text(value);
    $('.i-w-pay-money span').html(value);
});
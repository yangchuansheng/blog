$(function(){
    $('.pop-pic .tips a').click(function(){
        $('.pop-pic').hide();
        $('#wrapper').show();
    });

    $('.i-ali-ba-change').bind('input propertychange', function() {
        var value = $(this).val();
        if(!value || isNaN(value))
            return false;
        value = toDecimal2(value);
        $('.i-ali-ba-money').text(value);
        $('.i-w-wa-money span').html(value);
    });
});
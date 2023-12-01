$(function() {
    $(document).on('click', '#save', function () {
        var _this = $(this);
        var _scrT = $('.i-body').scrollTop();
        var div = $('#iphone').clone();
        var my_image = $('.my-image');
        var mask = $('.mask');
        if (!my_image.length) {
            my_image = $('<div class="my-image">成功生成图片，点击 <a class="my-image-view" target="_blank" href="#">这里</a> 查看，<a class="my-image-continue" href="#">继续制作</a></div>');
            $('body').append(my_image);
        }
        if (!mask.length) {
            $('body').append('<div class="mask"></div>');
        }
        div.removeClass('iphone-preview');
        div.css({
            zoom: 1,
            position: 'absolute',
            left: 0,
            top: 0
        });
        div.find('.i-body').css({
            marginTop: "-" + _scrT + "px"
        });
        $('#ifm').contents().find('body').append(div);
        _this.hide();
        $('.loading').show();
        $('.my-image').hide();
        $('.mask').hide();
        html2canvas(div, {
            allowTaint: true, taintTest: false,
            onrendered: function (canvas) {
                var myImage = canvas.toDataURL("image/png");
                var pop_pic = $('.pop-pic');
                var pop_class = 'pc';
                if (browser.versions.mobile) {
                    pop_class = 'mobile';
                }
                pop_pic.find('.tips').addClass(pop_class);
                pop_pic.find('img').attr('src', myImage);
                pop_pic.show();
                $('#wrapper').hide();
                $('.loading').hide();
                _this.show();
                div.remove();
            }
        });
        return false;
    });
});
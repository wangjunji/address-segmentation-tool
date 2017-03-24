var STATE = {
    editingAddress: ''
};
//加载LocalStorage
loadFileStorage();
//菜单Toggle
$('.toggle-menu').click(function() {
    toggleMenu();
});

$('#words').on('click', '.divider', function() {
    $(this).toggleClass('active');
    generateTagger();
    previewTaggingResult();
    if (!$('#words>.divider.active').size()) {
        $('#preview').hide();
    }
});
$('#preview-btn').click(function() {
    previewTaggingResult();
});
$('#reset-btn').click(function() {
    reset();
});
$('#confirm-btn').click(function() {
    submitTaggingResult(STATE.editingAddress);
});
$('#correct-btn').click(function() {
    if (!STATE.editingAddress) {
        return false;
    }
    $('#corrector').fadeToggle();
    $('#correct-input').val(STATE.editingAddress);
});
$('#correct-confirm').click(function() {
    $('#corrector').fadeOut();
    var originalAddress = STATE.editingAddress;
    var correctedAddress = $('#correct-input').val();
    saveCorrectedAddressToStorage(originalAddress, correctedAddress);
    STATE.editingAddress = correctedAddress;
    reset();
    loadAddressAndTagger(correctedAddress);
    $('#candidates td.editing').html(correctedAddress);
});
$('#import-txt-btn').click(function() {
    $('#txt-upload').trigger('click');
});
$('#import-json-btn').click(function() {
    $('#json-upload').trigger('click');
});
$('#export-json-btn').click(function() {
    exportJson();
});

$('#tagger').on('change', 'select', function() {
    previewTaggingResult();
});
$('#candidates').on('click', 'td', function() {
    $(this).parent().siblings().find('td').removeClass('editing');
    $(this).addClass('editing');
    var address = $(this).text();
    STATE.editingAddress = address;
    loadAddressAndTagger(address);
});
//popover
$('#candidates').popover({
    container: 'body',
    selector: 'td',
    html: true,
    content: function() {
        var text = $(this).text();
        var addresses = JSON.parse(window.localStorage.getItem('addresses'));
        var address = _.find(addresses, function(addr) {
            return addr.original_address == text || addr.corrected_address == text;
        });
        console.log(text);
        console.log(address)
        return '<pre>' + prettifyAddressJson(JSON.stringify(address)) + '</pre>';
    },
    trigger: 'hover'
});

function taggingKeyEventHandler(e) {
    if (e.target.tagName === 'INPUT') {
        e.preventDefault();
        return;
    }
    if (e.keyCode >= 49 && e.keyCode <= 57) {
        //1-9
        var pressedNum = e.keyCode - 48;
        var dividerLeft = $('#words>.divider.active').last().nextAll('.divider').size();
        var wordsLeft = dividerLeft ? dividerLeft + 1 : 0 || $('#words li.char').size();
        if (pressedNum < wordsLeft) {
            if (wordsLeft === $('#words li.char').size()) {
                $('#words>.divider').eq(pressedNum - 1).addClass('active');
            } else {
                $('#words>.divider.active').last().nextAll('.divider').eq(pressedNum - 1).addClass('active');
            }
            generateTagger();
            previewTaggingResult();

        }
    }
    if (KEY_CODES[e.keyCode] === 'backspace / delete') {
        $('#words>.divider.active').last().removeClass('active');
        generateTagger();
        previewTaggingResult();
        if (!$('#words>.divider.active').size()) {
            $('#preview').hide();
        }
    }
    var tagHotkeys = _.map(_.filter(OPTION.tags, function(tag) {
        return tag.hotkey;
    }), 'hotkey');
    if (tagHotkeys.indexOf(KEY_CODES[e.keyCode]) !== -1) {
        if (!$('#words .divider.active')) {
            return false;
        }
        var matchedTag = _.find(OPTION.tags, function(tag) {
            return tag.hotkey === KEY_CODES[e.keyCode]
        });
        $('#tagger select:focus option[value="' + matchedTag.value + '"]').prop('selected', true);
        var nextTabElemIndex = parseInt($('#tagger select:focus').attr('tabindex')) + 1;
        $('[tabindex="' + nextTabElemIndex + '"]').focus();
        previewTaggingResult();

    }
    if (KEY_CODES[e.keyCode] === 'enter') {
        submitTaggingResult(STATE.editingAddress);
    }
    if (KEY_CODES[e.keyCode] === 'escape') {
        reset();
    }
    if (KEY_CODES[e.keyCode] === '`') {
        toggleMenu();
    }
    if (KEY_CODES[e.keyCode] === 'left') {
        var prevTabElemIndex = parseInt($('#tagger select:focus').attr('tabindex')) - 1;
        $('[tabindex="' + prevTabElemIndex + '"]').focus();
    }
    if (KEY_CODES[e.keyCode] === 'right') {
        var nextTabElemIndex = parseInt($('#tagger select:focus').attr('tabindex')) + 1;
        $('[tabindex="' + nextTabElemIndex + '"]').focus();
    }
}
$(document).on('keyup', taggingKeyEventHandler);

//初始化地址
function initAddress(address) {
    $('#words').empty();
    var charArr = address.split('');
    var wordsHtml = [];
    $.each(charArr, function(i, word) {
        var html = '<li class="char">' + word + '</li>';
        if (i < charArr.length - 1) {
            html += '<li class="divider"></li>';
        }
        wordsHtml.push(html);
    })
    $('#words').append(wordsHtml.join(''));
}
//加载地址及标签选择
function loadAddressAndTagger(address) {
    var addresses = JSON.parse(window.localStorage.getItem('addresses'));
    var addr = _.find(addresses, function(addr) {
        return addr.original_address == address || addr.corrected_address == address;
    });
    initAddress(address);
    reset();
    if (addr.tags.length) {
        var count = 0;
        $.each(addr.segmentation, function(i, e) {
            count += e.length;
            $('#words .divider').eq(count - 1).addClass('active');
        });
        generateTagger();
        $.each(addr.tags, function(i, e) {
            $('#tagger select').eq(i).find('option[value="' + e + '"]').prop('selected', true);
        });
        previewTaggingResult();
    }
}

function getSegementation() {
    var currentWord = '';
    var segmentation = [];
    $('#words>li').each(function(i) {
        if ($(this).is('.char')) {
            currentWord += $(this).text();
        }
        if ($(this).is('.divider.active')) {
            segmentation.push(currentWord);
            currentWord = '';
        }
        if (i === $('#words>li').size() - 1) {
            segmentation.push(currentWord);
        }
    });
    return segmentation;
}

function generateTagger() {
    var tags = OPTION.tags;
    var segmentation = getSegementation();
    if (segmentation.length < 2) {
        $('#tagger').empty();
        return;
    }
    var options = tags.map(function(e, idx) {
        if (idx === 0) {
            return '<option value="' + e.value + '" selected>' + e.label + '</option>'
        } else {
            return '<option value="' + e.value + '">' + e.label + '</option>'
        }
    });
    var select = $('<li class="select"><select class="form-control">' + options + '</select></li>');
    var divider = $('<li class="divider"></li>');
    var unitWidth = $('#words>li.char').eq(0).width();
    var dividerWidth = $('#words>li.divider').eq(0).width();
    $('#tagger').empty();
    $.each(segmentation, function(i, seg) {
        var newSelect = select.clone();
        newSelect.width(function() {
            return unitWidth * seg.length + dividerWidth * (seg.length - 1);
        });
        newSelect.find('select').attr('tabindex', i + 2);
        var autocompleteValue = autocompleteSelect(seg, OPTION.tags);
        newSelect.find('option[value="' + autocompleteValue + '"]').prop('selected', true);
        $('#tagger').append(newSelect);
        if (i < segmentation.length - 1) {
            $('#tagger').append(divider.clone());
        }
    })
}

function autocompleteSelect(seg, tags) {
    var lastChar = seg.slice(-1);
    var matchedTag = _.find(tags, function(tag) {
        if (tag.autocomplete) {
            return tag.autocomplete.indexOf(lastChar) != -1;
        }
    });
    return matchedTag ? matchedTag.value : '';
}

function toggleMenu() {
    $('#aside').toggleClass('active');
    $('.container').toggleClass('menu-out');
    if ($('#aside').hasClass('active')) {
        $('.instruction .col-xs-2').eq(0).hide();
        $('.instruction .col-xs-2').removeClass('col-xs-2').addClass('col-xs-3');
    } else {
        $('.instruction .col-xs-3').eq(0).show();
        $('.instruction .col-xs-3').removeClass('col-xs-3').addClass('col-xs-2');
    }
}

function previewTaggingResult() {
    var segmentation = getSegementation();
    var tags = []
    $('#tagger select').each(function() {
        tags.push($(this).val());
    });
    $('#preview').html(JSON.stringify(segmentation) + '\n' + JSON.stringify(tags)).show();
}

function submitTaggingResult(address) {
    var addresses = JSON.parse(window.localStorage.getItem('addresses'));
    if (!STATE.editingAddress) {
        return;
    }
    var segmentation = getSegementation();
    var tags = []
    $('#tagger select').each(function() {
        tags.push($(this).val());
    });
    if (!tags.length) {
        return;
    }
    var matchedAddress = _.find(addresses, function(addr) {
        return addr.original_address == address || addr.corrected_address == address;
    });
    var index = _.indexOf(addresses, matchedAddress);
    var updateAddress = _.extend(matchedAddress, {
        tags: tags,
        segmentation: segmentation
    });
    if (address === matchedAddress.original_address) {
        updateAddress.corrected_address = '';
    }
    addresses.splice(index, 1, updateAddress);
    window.localStorage.setItem('addresses', JSON.stringify(addresses));
    setTimeout(function() {
        loadFileStorage();
        reset();
    }, 100);
}

function reset() {
    $('#words>.divider').removeClass('active');
    $('#tagger').empty();
    $('#preview').hide();
    $('#corrector').hide();
    $('#correct-input').val('');
}
$('.focus-guard-start').on('focus', function() {
    $('#tagger select').eq(0).focus();
});

$('.focus-guard-end').on('focus', function() {
    $('#tagger select').eq(0).focus();
});

window.onload = function() {
    //上传txt
    var fileInput = document.getElementById('txt-upload');

    fileInput.addEventListener('change', function(e) {
        var file = fileInput.files[0];
        var textType = /text.*/;

        if (file.type.match(textType)) {
            var reader = new FileReader();

            reader.onload = function(e) {
                saveFileStorage(reader.result);
                loadFileStorage();
                reset();
            }
            reader.readAsText(file, 'gb2312');
        } else {
            alert("格式不支持!");
        }
    });
    //上传json
    var jsonInput = document.getElementById('json-upload');

    jsonInput.addEventListener('change', function(e) {
        var file = jsonInput.files[0];

        if (file.type === 'application/json') {
            var reader = new FileReader();

            reader.onload = function(e) {
                saveJsonStorage(reader.result);
                loadFileStorage();
                reset();
            }
            reader.readAsText(file);
        } else {
            alert("格式不支持!");
        }
    });
}

function saveJsonStorage(json) {
    window.localStorage.setItem('addresses', json);
}

function saveFileStorage(file) {
    var arr = file.split(/\r?\n/);
    var addresses = [];
    $.each(arr, function(i, e) {
        var id, address;
        if (e.match(/(^\d+),/)) {
            id = e.match(/(^\d+),/)[1];
            address = e.replace(/^\d+,/, '');
        }
        if (e) {
            addresses.push({
                'id': id ? id : '',
                'original_address': address ? address : e,
                'corrected_address': '',
                'segmentation': [],
                'tags': []
            });
        }
    });
    window.localStorage.setItem('addresses', JSON.stringify(addresses));
}
//纠正地址写入
function saveCorrectedAddressToStorage(originalAddress, correctedAddress) {
    var addresses = JSON.parse(window.localStorage.getItem('addresses'));
    var matchedAddress = _.find(addresses, function(addr){
    	return addr.original_address==originalAddress || addr.corrected_address==originalAddress
    });
    var index = _.indexOf(addresses, matchedAddress);
    addresses.splice(index, 1, {
        id: matchedAddress.id ? matchedAddress.id : '',
        original_address: matchedAddress.original_address,
        corrected_address: correctedAddress===matchedAddress.original_address?'':correctedAddress,
        tags: [],
        segmentation: []
    });
    window.localStorage.setItem('addresses', JSON.stringify(addresses));
}
//加载缓存
function loadFileStorage() {
    var addresses = JSON.parse(window.localStorage.getItem('addresses'));
    if (!addresses || !addresses.length) {
        return;
    }
    $('#candidates tbody').empty();
    $.each(addresses, function(i, e) {
        var addr = e.corrected_address ? e.corrected_address : e.original_address;
        if (e.tags.length) {
            $('#candidates tbody').append('<tr><td class="tagged">' + addr + '</td></tr>');
        } else {
            $('#candidates tbody').append('<tr><td>' + addr + '</td></tr>');
        }
    });
    var lastUntaggedAddress = _.find(addresses, function(x) {
        return !x.tags.length
    });
    var currentIndex = _.indexOf(addresses, _.find(addresses, {
        original_address: lastUntaggedAddress.original_address
    }));
    $('#candidates tbody tr').eq(currentIndex).find('td').addClass('editing');
    initAddress(lastUntaggedAddress.corrected_address ? lastUntaggedAddress.corrected_address : lastUntaggedAddress.original_address);
    STATE.editingAddress = lastUntaggedAddress.original_address;
}

//导出JSON
function exportJson() {
    var addressesJson = window.localStorage.getItem('addresses');
    addressesJson = prettifyAddressJson(addressesJson);
    var blob = new Blob([addressesJson], {
        type: 'application/json'
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.download = "addresses.json";
    a.href = url;
    var evt = document.createEvent('MouseEvents');
    evt.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
    a.dispatchEvent(evt);
}

function prettifyAddressJson(json) {
    return JSON.stringify(JSON.parse(json), function(k, v) {
            if (k === "tags" || k === "segmentation") {
                return JSON.stringify(v);
            }
            return v;
        }, 2).replace(/\\/g, '')
        .replace(/\"\[/g, '[')
        .replace(/\]\"/g, ']')
        .replace(/\"\{/g, '{')
        .replace(/\}\"/g, '}');
}

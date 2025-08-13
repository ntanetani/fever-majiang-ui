/*
 *  fadein.js
 */
"use strict";

module.exports = {

    show: node => node.removeClass('hide fadeout'),

    hide: node => node.addClass('hide fadeout'),

    fadeIn: node => {
        // 初期状態を必ず整える
        node.addClass('hide fadeout');
        setTimeout(() => {
            node.removeClass('hide');
            requestAnimationFrame(() => {
                node.off('transitionend').removeClass('fadeout');
                // 念のための保険: 少し後に再度fadeout除去
                setTimeout(() => node.removeClass('fadeout'), 200);
            });
        }, 50);
        return node;
    },

    fadeOut: node =>
        node.on('transitionend', () =>
            node.off('transitionend')
                .addClass('hide'))
            .addClass('fadeout'),
}

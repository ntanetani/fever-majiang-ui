/*
 *  Majiang.UI.Player
 */
"use strict";

const $ = require('jquery');
const Majiang = require('@kobalab/majiang-core');

const { hide, show, fadeIn } = require('./fadein');
const { setSelector, clearSelector } = require('./selector');

const mianzi = require('./mianzi');

module.exports = class Player extends Majiang.Player {

    constructor(root, pai, audio) {
        super();
        this._node = {
            root: root,
            timer: $('.timer', root),
            button: $('.player-button', root),
            mianzi: $('.select-mianzi', root),
            dapai: $('.shoupai.main .bingpai', root),
        };
        this._mianzi = mianzi(pai);

        this.sound_on = true;
        this._audio = { beep: audio('beep') };

        this.clear_handler();
    }

    _say(name, l, p) {
        if (this._view && typeof this._view.say === 'function') {
            this._view.say(name, l, p);
        }
    }

    clear_handler() {
        this.clear_button();
        this.clear_mianzi();
        this.clear_dapai();
        clearSelector('kaiju');
        clearSelector('dialog');
        clearSelector('summary');
    }

    callback(reply) {
        this.clear_timer();
        this.clear_handler();
        this._callback(reply);
        return false;
    }

    set_button(type, callback) {
        show($(`.${type}`, this._node.button)
            .attr('tabindex', 0)
            .on('click.button', callback));
        this._show_button = true;
    }

    show_button(callback = () => { }) {
        this.show_timer();
        if (!this._show_button) return callback();
        const handler = () => { this.clear_button(); callback() };
        this.set_button('cansel', handler);
        this._node.root.on('click.button', handler);

        show(this._node.button.width($(this._node.dapai).width()));
        setSelector($('.button[tabindex]', this._node.button),
            'button', { focus: -1, touch: false });
    }

    clear_button() {
        hide($('.button', this._node.button));
        clearSelector('button');
        hide(this._node.button);
        this._node.root.off('.button');
        this._show_button = false;
    }

    select_mianzi(mianzi) {
        this.clear_button();
        this._node.mianzi.empty();
        for (let m of mianzi) {
            let msg = m.match(/\d/g).length == 4 ? { gang: m } : { fulou: m }
            if (!this._default_reply) this._default_reply = msg;
            this._node.mianzi.append(
                this._mianzi(m, true)
                    .on('click.mianzi', () => this.callback(msg)));
        }
        show(this._node.mianzi.width($(this._node.dapai).width()));
        setSelector($('.mianzi', this._node.mianzi), 'mianzi',
            { touch: false, focus: null });
        return false;
    }

    clear_mianzi() {
        setTimeout(() => hide(this._node.mianzi), 400);
        clearSelector('mianzi');
    }

    select_dapai(lizhi) {

        if (lizhi) this._default_reply = { dapai: lizhi[0] + '*' };

        for (let p of lizhi || this.get_dapai(this.shoupai)) {
            let pai = $(p.slice(-1) == '_'
                ? `.zimo .pai[data-pai="${p.slice(0, 2)}"]`
                : `> .pai[data-pai="${p}"]`,
                this._node.dapai);
            if (lizhi) {
                pai.addClass('blink');
                p += '*';
            }
            pai.attr('tabindex', 0).attr('role', 'button')
                .on('click.dapai', (ev) => {
                    $(ev.target).addClass('dapai');
                    this.callback({ dapai: p });
                });
        }

        setSelector($('.pai[tabindex]', this._node.dapai),
            'dapai', { focus: -1 });
    }

    clear_dapai() {
        $('.pai', this._node.dapai).removeClass('blink');
        clearSelector('dapai');
    }

    set_timer(limit, allowed = 0, audio) {

        delete this._default_reply;

        let time_limit = Date.now() + (limit + allowed) * 1000;

        if (this._timer_id) clearInterval(this._timer_id);
        this._timer_id = setInterval(() => {
            if (time_limit <= Date.now()) {
                this.callback(this._default_reply);
                return;
            }
            let time = Math.ceil((time_limit - Date.now()) / 1000);
            if (time <= limit || time <= allowed) {
                if (time != this._node.timer.text()) {
                    if (this.sound_on && audio && time <= 5) {
                        audio.currentTime = 0;
                        audio.play();
                    }
                    this._node.timer.text(time);
                }
            }
        }, 200);
    }

    show_timer() {
        show(this._node.timer.width($(this._node.dapai).width() + 20));
    }

    clear_timer() {
        this._timer_id = clearInterval(this._timer_id);
        hide(this._node.timer.text(''));
    }

    action(msg, callback) {
        let limit, allowed;
        if (msg.timer) [limit, allowed] = msg.timer;
        let audio = !(msg.kaiju || msg.hule || msg.pingju) && this._audio.beep;
        if (limit) this.set_timer(limit, allowed, audio);

        super.action(msg, callback);
    }

    action_kaiju(kaiju) {
        if (!this._view) this.callback();
        $('.kaiju', this._node.root).off('click')
            .on('click.kaiju', () => this.callback());
        setTimeout(() => {
            setSelector($('.kaiju', this._node.root), 'kaiju',
                { touch: false });
        }, 800);
    }

    action_qipai(qipai) { this.callback() }

    action_zimo(zimo, gangzimo) {
        if (zimo.l != this._menfeng) return this.callback();

        if (this.allow_hule(this.shoupai, null, gangzimo)) {
            this.set_button('zimo', () => this.callback({ hule: '-' }));
        }

        if (this.allow_pingju(this.shoupai)) {
            this.set_button('pingju', () => this.callback({ daopai: '-' }));
        }

        const gang_mianzi = this.get_gang_mianzi(this.shoupai) || [];
        if (gang_mianzi.length == 1) {
            this.set_button('gang', () => this.callback({ gang: gang_mianzi[0] }));
        }
        else if (gang_mianzi.length > 1) {
            this.set_button('gang', () => this.select_mianzi(gang_mianzi));
        }

        if (this.shoupai.lizhi) {
            this.show_button(() => this.callback({ dapai: zimo.p + '_' }));
            return;
        }

        let lizhi_dapai = this.allow_lizhi(this.shoupai);
        if (lizhi_dapai.length) {
            this.set_button('lizhi', () => {
                this.clear_handler();
                this.select_dapai(lizhi_dapai);
            });
        }

        this.show_button(() => this.select_dapai());
    }

    action_dapai(data) {

        const dapai = data && typeof data.p === 'string' ? data
            : (data && data.dapai) ? data.dapai : null;
        if (!dapai || typeof dapai.p !== 'string') return;

        let p2 = dapai.p.substr(0, 2);
        if (dapai.p.match(/[\+\=\-]$/)) {
            this._say('副露', this._model.lunban);
        }
        else {
            this._say('打', this._model.lunban, p2);
        }

        // 自家の打牌通知 → 音声再生のみして即応答
        if (dapai.l == this._menfeng) {
            clearTimeout(this._timeout_id);
            this._timeout_id = setTimeout(() => {
                if (!this.sound_on) return;
                let filename = 'dapai';
                if (dapai.p.match(/[\+\=\-]$/)) filename = 'fulou';
                setTimeout(() => {
                    if (this._audio[filename] && this._audio[filename][this._menfeng]) {
                        this._audio[filename][this._menfeng].play();
                    }
                }, 500);
            }, this.speed);
            this.callback();
            return;
        }

        // 他家の打牌 → ロン/ポン(カン)の選択可否を提示
        const d = ['', '+', '=', '-'][(3 + dapai.l - this._menfeng) % 3];
        const p = dapai.p.slice(0, 2) + d;

        let hasChoice = false;

        // ロン（ノー聴ボタンは不要なので出さない）
        if (this.allow_hule(this.shoupai, p)) {
            this.set_button('rong', () => this.callback({ hule: '-' }));
            hasChoice = true;
        }

        // ポン/大明槓
        const gang = this.get_gang_mianzi(this.shoupai, p) || [];
        const peng = this.get_peng_mianzi(this.shoupai, p) || [];
        const mianzi = gang.concat(peng);
        if (mianzi.length == 1) {
            const m = mianzi[0];
            const isGang = /\d{4}$/.test(m);
            this.set_button(isGang ? 'gang' : 'peng', () => this.callback(isGang ? { gang: m } : { fulou: m }));
            hasChoice = true;
        }
        else if (mianzi.length > 1) {
            this.set_button('peng', () => this.select_mianzi(mianzi));
            hasChoice = true;
            // デフォルト選択（最初の候補）を用意しておき、タイムアウト時はそれで鳴く
            if (!this._default_reply) {
                const m0 = mianzi[0];
                const isGang0 = /\d{4}$/.test(m0);
                this._default_reply = isGang0 ? { gang: m0 } : { fulou: m0 };
            }
        }

        // スルー
        this.set_button('daopai', () => this.callback({ daopai: '-' }));

        if (hasChoice) {
            this.show_button(() => this.callback());
        }
        else {
            this.callback();
        }
    }

    action_fulou(fulou) {

        clearTimeout(this._timeout_id);
        this._timeout_id = setTimeout(() => {

            if (!this.sound_on) return;
            let m = fulou.m.replace(/0/g, '5');
            if (m.match(/^[mps]\d{3}/)) {
                setTimeout(() => {
                    if (this._audio.gang && this._audio.gang[this._menfeng]) {
                        this._audio.gang[this._menfeng].play();
                    }
                }, 500);
            }
            else if (m.match(/^[mps](\d)\1\1/)) {
                setTimeout(() => {
                    if (this._audio.peng && this._audio.peng[this._menfeng]) {
                        this._audio.peng[this._menfeng].play();
                    }
                }, 500);
            }
        }, this.speed);

        // 自家の鳴きならここで打牌選択へ。相手の鳴きは従来通り即時コールバック
        if (fulou.l == this._menfeng) {
            this.show_button(() => this.select_dapai());
        }
        else {
            this.callback();
        }
    }

    action_gang(gang) {

        let p = gang.m.substr(0, 1) + gang.m.substr(1, 1).replace(/0/, '5');
        this._say('杠', this._model.lunban, p);

        clearTimeout(this._timeout_id);
        this._timeout_id = setTimeout(() => {

            if (!this.sound_on) return;
            setTimeout(() => {
                if (this._audio.gang && this._audio.gang[this._menfeng]) {
                    this._audio.gang[this._menfeng].play();
                }
            }, 500);

        }, this.speed);
        this.callback();
    }

    action_hule() {
        $('.hule-dialog', this._node.root).off('click')
            .on('click.dialog', () => this.callback());
        clearTimeout(this._hule_timer);
        this._hule_timer = setTimeout(() => {
            setSelector($('.hule-dialog', this._node.root), 'dialog',
                { touch: false });
            setTimeout(() => {
                if ($('.hule-dialog:visible', this._node.root).length) {
                    this.callback();
                }
            }, 10000);
        }, 800);
    }

    action_pingju() {
        this.action_hule();
    }

    action_jieju(jieju) {
        $('.summary', this._node.root).off('click')
            .on('click.summary', () => this.callback());
        setTimeout(() => {
            setSelector($('.summary', this._node.root), 'summary',
                { touch: false });
        }, 800);
    }
}

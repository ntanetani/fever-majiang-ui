/*
 *  Majiang.UI.Paipu
 */
"use strict";

const Majiang = require('@kobalab/majiang-core');
const Board   = require('./board');

const { hide, show } = require('./fadein');
const logconv = require('@kobalab/tenhou-url-log');

const class_name = ['main','xiajia','duimian','shangjia'];

module.exports = class Paipu {

    constructor(root, paipu, pai, audio, pref, callback, analyzer) {
        this._root  = root;
        this._paipu = paipu;
        this._model = new Majiang.Board(paipu);
        this._view  = new Board($('.board', root), pai, audio, this._model);
        this._pref  = pref;

        this._log_idx = -1;
        this._idx     =  0;

        this._deny_repeat;
        this._repeat_timer;
        this._autoplay;
        this._autoplay_timer;

        this._view.open_shoupai = true;
        this._view.open_he      = true;

        this._speed = 3;
        this._summary = false;

        this._callback      = callback;
        this._open_analyzer = analyzer;
    }

    get_pref() {
        if (localStorage.getItem(this._pref)) {
            return JSON.parse(localStorage.getItem(this._pref));
        }
        else {
            return {
                sound_on: this._view.sound_on,
                speed:    this._speed
            };
        }
    }

    set_pref() {
        let pref = {
            sound_on: this._view.sound_on,
            speed:    this._speed
        };
        localStorage.setItem(this._pref, JSON.stringify(pref));
    }

    set_handler() {
        this.clear_handler();

        const ctrl = $('.controller', this._root);

        this._root.on('mousedown', (ev)=>{
            if (ev.button) return true;
            this.next();
            return false;
        });
        this._root.on('mouseup mousemove touchend', ()=>{
            this._repeat_timer = clearInterval(this._repeat_timer);
            if (this._repeet) {
                this._repeet = false;
                if (this._analyzer) {
                    if (this._deny_repeat) {
                        this._analyzer.clear();
                    }
                    else {
                        this.seek(this._log_idx, this._idx -1);
                        this._analyzer.active(true);
                    }
                }
            }
        });
        $('.next', ctrl).on('mousedown touchstart', ()=>{
            if (this._repeat_timer) return false;
            this.next();
            this._repeat_timer = setTimeout(()=>{
                this._repeet = true;
                if (this._analyzer) this._analyzer.active(false);
                this._repeat_timer = setInterval(()=>{
                    if (! this._deny_repeat) this.next();
                }, 80);
            }, 200);
            return false;
        });
        $('.prev', ctrl).on('mousedown touchstart', ()=>{
            if (this._repeat_timer) return false;
            this.prev();
            this._repeat_timer = setTimeout(()=>{
                this._repeet = true;
                if (this._analyzer) this._analyzer.active(false);
                this._repeat_timer = setInterval(()=>this.prev(), 80);
            }, 200);
            return false;
        });
        $('.last',     ctrl).on('mousedown', ()=>this.forward());
        $('.first',    ctrl).on('mousedown', ()=>this.backward());
        $('.play',     ctrl).on('mousedown', ()=>this.autoplay());
        $('.summary',  ctrl).on('mousedown', ()=>this.summary());
        $('.analyzer', ctrl).on('mousedown', ()=>this.analyzer());
        $('.export',   ctrl).on('mousedown', ()=>this.tenhou_dialog());
        $('.sound',    ctrl).on('mousedown', ()=>this.sound(
                                                    ! this._view.sound_on));
        $('.minus',    ctrl).on('mousedown', ()=>this.speed(this._speed - 1));
        $('.plus',     ctrl).on('mousedown', ()=>this.speed(this._speed + 1));
        $('.exit',     ctrl).on('mousedown', ()=>this.exit());
        for (let i = 0; i < 3; i++) {
            $(`.shoupai.${class_name[i]}`, this._root)
                            .on('mousedown', '.pai', ()=>this.shoupai());
            $(`.he.${class_name[i]}`, this._root)
                            .on('mousedown', '.pai', ()=>this.he());
            $(`.player.${class_name[i]}`, this._root)
                            .addClass('selectable')
                            .on('mousedown', ()=>this.viewpoint(
                                                    this._view.viewpoint + i));
            $(`.player .${class_name[i]}`, this._root)
                            .addClass('selectable')
                            .on('mousedown', ()=>{
                                this.viewpoint(this._view.viewpoint + i);
                            });
        }
        show($('> *',       ctrl));
        hide($('.play.off', ctrl));

        $(window).on('keyup.paipu', (ev)=>{

            if (this._repeet) {
                this._repeet = false;
                if (this._analyzer) {
                    if (this._deny_repeat) {
                        this._analyzer.clear();
                    }
                    else {
                        this.seek(this._log_idx, this._idx -1);
                        this._analyzer.active(true);
                    }
                }
            }

            if      (ev.key == 'ArrowRight') this.forward();
            else if (ev.key == 'ArrowLeft')  this.backward();
            else if (ev.key == ' ') this.autoplay();
            else if (ev.key == 'v') this.viewpoint(this._view.viewpoint + 1);
            else if (ev.key == '?') this.summary();
            else if (ev.key == 'i') this.analyzer();
            else if (ev.key == 't') this.tenhou_dialog();
            else if (ev.key == 'a') this.sound(! this._view.sound_on);
            else if (ev.key == '-') this.speed(this._speed - 1);
            else if (ev.key == '+') this.speed(this._speed + 1);
            else if (ev.key == 's') this.shoupai();
            else if (ev.key == 'h') this.he();
            else if (ev.key == 'q' || ev.key == 'Escape')
                                    this.exit();
            else if (ev.key == 'p') {
                if (this._log_idx < 0) this.dummy_name(this._view.viewpoint);
                this.viewpoint(this._view.viewpoint);
            }
        });

        $(window).on('keydown.paipu', (ev)=>{

            if (ev.key.match(/^Arrow/)) ev.preventDefault();

            if (ev.originalEvent.repeat) {
                this._repeet = true;
                if (this._analyzer) this._analyzer.active(false);
                if (this._deny_repeat) return;
            }

            if      (ev.key == 'Enter')     this.next();
            else if (ev.key == 'ArrowDown') this.next();
            else if (ev.key == 'ArrowUp')   this.prev();
        });

        let pref = this.get_pref();
        this.sound(pref.sound_on);
        this.speed(pref.speed);
    }

    clear_handler() {
        if (this._autoplay) this.autoplay();
        this.set_fragment('');
        const ctrl = $('.controller', this._root);
        this._root.off('mousedown mouseup mousemove touchstart touchend');
        $('.player *').removeClass('selectable').off('mousedown');
        $('.player').removeClass('selectable').off('mousedown');
        $('.shoupai', this._root).off('mousedown', '.pai');
        $('.he', this._root).off('mousedown', '.pai');
        $('*', ctrl).off('mousedown touchstart');
        $(window).off('.paipu');
    }

    start(viewpoint = 0, log_idx = -1, idx = 0) {

        this._html_title = $('title').text();
        let title = this._paipu.title + ' - ' + this._html_title;
        $('title').text(title);
        $('meta[property="og:title"]').attr('content', title);

        $('.tenhou-dialog input[name="limited"]', this._root)
                                    .prop('disabled', false).val([0]);

        this.set_handler();

        this._view.viewpoint = (4 + viewpoint % 4) % 4;
        this.set_fragment();

        if (log_idx < 0) {
            hide($('.controller', this._root));
            this._view.kaiju();
        }
        else {
            this.seek(log_idx, idx);
        }
    }

    suspend() {
        show($('.suspend', this._root));
        this._deny_repeat = true;
    }

    exit() {
        $('title').text(this._html_title);
        $('meta[property="og:title"]').attr('content', this._html_title);

        this.clear_handler();
        this._callback();
    }

    seek(log_idx, idx) {

        this._deny_repeat = false;
        if (this._summary) this.summary();

        log_idx = log_idx < 0   ? 0
                : this._paipu.log.length - 1 < log_idx
                                ? this._paipu.log.length - 1
                : log_idx;
        idx     = idx < 0       ? 0
                : this._paipu.log[log_idx].length - 1 < idx
                                ? this._paipu.log[log_idx].length - 1
                : idx;

        this._log_idx = log_idx;
        this._idx     = 0;
        this._redo    = false;

        let data;

        while (this._idx <= idx) {

            data = this._paipu.log[this._log_idx][this._idx];

            if      (data.qipai)    this._model.qipai(data.qipai);
            else if (data.zimo)     this._model.zimo(data.zimo);
            else if (data.dapai)    this._model.dapai(data.dapai);
            else if (data.fulou)    this._model.fulou(data.fulou);
            else if (data.gang)     this._model.gang(data.gang);
            else if (data.gangzimo) this._model.zimo(data.gangzimo);
            else if (data.kaigang)  this._model.kaigang(data.kaigang);
            else if (data.hule)     this._model.hule(data.hule);
            else if (data.pingju)   this._model.pingju(data.pingju);

            if (this._analyzer && ! this._repeet) {
                if (idx == this._idx) this._analyzer.action(data);
                else                  this._analyzer.next(data);
            }

            this._idx++;
        }

        this.set_fragment();

        this._view.redraw();
        hide($('.suspend', this._root));
        show($('.controller', this._root));
        if (data.hule || data.pingju) {
            this._deny_repeat = true;
            this._view.update(data);
        }
    }

    next() {

        hide($('.suspend', this._root));
        show($('.controller', this._root));

        this._autoplay_timer = clearTimeout(this._autoplay_timer);

        if (this._log_idx < 0) {
            this._log_idx = 0;
            this._idx = 0;
        }
        if (this._log_idx == this._paipu.log.length) {
            this.exit();
            return;
        }
        if (this._idx >= this._paipu.log[this._log_idx].length) {
            if (! this._deny_repeat) return this.suspend();
            this._model.last();
            this._log_idx++;
            this._idx = 0;
        }
        if (this._log_idx == this._paipu.log.length) {
            if (this._target_log_idx != null) this.exit();
            this._deny_repeat = false;
            if (this._paipu.defen.length) this._model.jieju(this._paipu);
            this._view.update();
            this.summary();
            return;
        }
        if (this._summary) {
            this.summary();
            return;
        }

        let data = this._paipu.log[this._log_idx][this._idx];

        if      (data.qipai)    this.qipai(data);
        else if (data.zimo)     this.zimo(data);
        else if (data.dapai)    this.dapai(data);
        else if (data.fulou)    this.fulou(data);
        else if (data.gang)     this.gang(data);
        else if (data.gangzimo) this.gangzimo(data);
        else if (data.kaigang)  this.kaigang(data);
        else if (data.hule)     this.hule(data);
        else if (data.pingju)   this.pingju(data);

        if (this._analyzer && ! this._redo
            && ! this._repeet) this._analyzer.action(data);

        if (! this._redo) this._idx++;

        if (this._paipu.log[this._log_idx][this._idx]
            && this._paipu.log[this._log_idx][this._idx].kaigang) this.next();

        if (this._autoplay) {
            let delay = this._redo        ? 500
                      : this._deny_repeat ? 3000 + this._speed * 2000
                      :                     this._speed * 200;
            this._autoplay_timer = setTimeout(()=>this.next(), delay);
        }

        this.set_fragment();
    }

    prev() {
        if (this._summary || this._log_idx < 0 || this._idx == 0) return true;
        if (this._autoplay) this.autoplay();
        let idx = this._idx - 1;
        while (idx > 0) {
            let data = this._paipu.log[this._log_idx][idx];
            if (! data.kaigang) break;
            idx--;
        }
        while (idx > 0) {
            let data = this._paipu.log[this._log_idx][--idx];
            if (data.zimo || data.gangzimo || data.fulou) break;
        }
        while (idx < this._paipu.log[this._log_idx].length) {
            let data = this._paipu.log[this._log_idx][idx + 1];
            if (! data.kaigang) break;
            idx++;
        }
        this.seek(this._log_idx, idx);
    }

    qipai(data) {
        if (this._target_log_idx != null
            && this._log_idx != this._target_log_idx) this.exit();
        this._deny_repeat = false;
        this._model.qipai(data.qipai);
        this._view.redraw();
    }

    zimo(data) {
        this._model.zimo(data.zimo);
        this._view.update(data);
    }

    dapai(data) {
        if (data.dapai.p.slice(-1) == '*' && ! this._redo) {
            this._redo = true;
            this._view.say('lizhi', data.dapai.l);
            return;
        }
        this._redo = false;
        this._model.dapai(data.dapai);
        this._view.update(data);
    }

    fulou(data) {
        if (! this._redo) {
            this._redo = true;
            let m = data.fulou.m.replace(/0/,'5');
            if      (m.match(/^[mpsz](\d)\1\1\1/))
                                        this._view.say('gang', data.fulou.l);
            else if (m.match(/^[mpsz](\d)\1\1/))
                                        this._view.say('peng', data.fulou.l);
            else                        this._view.say('chi',  data.fulou.l);
            return;
        }
        this._redo = false;
        this._model.fulou(data.fulou);
        this._view.update(data);
    }

    gang(data) {
        if (! this._redo) {
            this._redo = true;
            this._view.say('gang', data.gang.l);
            return;
        }
        this._redo = false;
        this._model.gang(data.gang);
        this._view.update(data);
    }

    gangzimo(data) {
        this._model.zimo(data.gangzimo);
        this._view.update(data);
    }

    kaigang(data) {
        this._model.kaigang(data.kaigang);
        this._view.update(data);
    }

    hule(data) {
        if (! this._redo
            && ! this._paipu.log[this._log_idx][this._idx - 1].hule)
        {
            this._redo = true;
            if (data.hule.baojia == null) this._view.say('zimo', data.hule.l);
            else                          this._view.say('rong', data.hule.l);
            let i = 1;
            while (this._idx + i < this._paipu.log[this._log_idx].length) {
                let data = this._paipu.log[this._log_idx][this._idx + i];
                this._view.say('rong', data.hule.l)
                i++;
            }
            return;
        }
        this._redo = false;
        this._model.hule(data.hule);
        this._view.update(data);
        this._deny_repeat = true;
    }

    pingju(data) {
        if (! this._redo && data.pingju.name.match(/^三家和/)) {
            this._redo = true;
            for (let i = 1; i < 3; i++) {
                let l = (this._model.lunban + i) % 4;
                this._view.say('rong', l);
            }
            return;
        }
        this._redo = false;
        this._model.pingju(data.pingju);
        this._view.update(data);
        this._deny_repeat = true;
    }

    top(log_idx) {
        if (this._autoplay) this.autoplay();
        if (log_idx < 0 || this._paipu.log.length <= log_idx) return false;
        this.seek(log_idx, 0);
        if (this._target_log_idx != null
            && this._log_idx != this._target_log_idx) this.exit();
        return false;
    }

    last() {
        if (this._autoplay) this.autoplay();
        let idx  = this._paipu.log[this._log_idx].length - 1;
        let data = this._paipu.log[this._log_idx][idx];
        while (idx > 0 && (data.hule || data.pingju)) {
            data = this._paipu.log[this._log_idx][--idx];
        }
        this.seek(this._log_idx, idx);
        data = this._paipu.log[this._log_idx][this._idx];
        if (data.hule || data.pingju) {
            this.next();
            if (this._redo) setTimeout(()=> this.next(), 400);
        }
        return false;
    }

    forward() {
        if (this._summary) return true;
        if (this._log_idx < 0
            || this._paipu.log.length <= this._log_idx) return false;
        if (this._idx < this._paipu.log[this._log_idx].length
            && ! this._deny_repeat)
                return this.last();
        else    this.next();
        return false;
    }

    backward() {
        if (this._summary) return true;
        if (this._paipu.log.length <= this._log_idx) return true;
        if (this._idx > 1)
                return this.top(this._log_idx);
        else    return this.top(this._log_idx - 1);
    }

    preview(log_idx) {
        this._target_log_idx = log_idx;
        let viewpoint = this._paipu.qijia;
        if (log_idx >= 0) {
            let qipai = this._paipu.log[log_idx][0].qipai;
            viewpoint = (this._paipu.qijia + qipai.jushu) % 4;
        }
        this.start(viewpoint, log_idx);

        $('.tenhou-dialog input[name="limited"]', this._root)
                                    .prop('disabled', true).val([1]);
    }

    summary() {
        if (this._log_idx < 0 || this._deny_repeat) return true;
        if (this._summary) {
            this._view.summary();
            if (this._analyzer) this._analyzer.active(true);
            show($('.controller', this._root));
            this._summary = false;
            if (this._autoplay) this.next();
            return false;
        }
        this._autoplay_timer = clearTimeout(this._autoplay_timer);
        hide($('.controller', this._root));
        if (this._analyzer) this._analyzer.active(false);
        this._view.summary(this._paipu);
        for (let i = 0; i < this._paipu.log.length; i++) {
            $('.summary tbody tr', this._root).eq(i)
                .on('mousedown', (ev)=> this.top(i));
        }
        $('.summary', this._root).addClass('paipu')
        this._summary = true;
        return false;
    }

    viewpoint(viewpoint) {
        if (this._summary) return true;
        if (this._autoplay) this.autoplay();
        viewpoint = viewpoint % 4;
        if (viewpoint == this._view.viewpoint) {
            if (this._log_idx >= 0) this.dummy_name(viewpoint);
        }
        else {
            this._view.viewpoint = viewpoint;
            if (this._analyzer) {
                this._analyzer.id(this._view.viewpoint);
                if (this._log_idx >= 0) this.seek(this._log_idx, this._idx - 1);
            }
        }
        this.set_fragment();
        if (this._log_idx < 0) {
            this._view.kaiju();
            return false;
        }
        this._view.redraw();
        let data = this._paipu.log[this._log_idx][this._idx - 1];
        if (data.hule || data.pingju) this._view.update(data);
        return false;
    }

    dummy_name(dummy_name) {
        if (this._view.dummy_name === undefined) return;
        this._view.dummy_name
                = this._view.dummy_name == null ? dummy_name : null;
    }

    speed(speed) {
        if (speed < 1) speed = 1;
        if (speed > 5) speed = 5;
        this._speed = speed;
        const ctrl = $('.controller', this._root);
        $('.speed span', ctrl).each((i, n)=>{
            $(n).css('visibility', i < speed ? 'visible' : 'hidden');
        });
        this.set_pref();
        return false;
    }

    sound(on) {
        this._view.sound_on = on;
        const ctrl = $('.controller', this._root);
        if (on) {
            hide($('.sound.off', ctrl));
            show($('.sound.on', ctrl));
        }
        else {
            hide($('.sound.on', ctrl));
            show($('.sound.off', ctrl));
        }
        this.set_pref();
        return false;
    }

    shoupai() {
        if (this._summary) return true;
        this._view.open_shoupai = ! this._view.open_shoupai;
        this.set_fragment();
        if (this._log_idx < 0) return false;
        this._view.redraw();
        let data = this._paipu.log[this._log_idx][this._idx - 1];
        if (data.hule || data.pingju) this._view.update(data);
        return false;
    }

    he() {
        if (this._summary) return true;
        this._view.open_he = ! this._view.open_he;
        this.set_fragment();
        if (this._log_idx < 0) return false;
        this._view.redraw();
        let data = this._paipu.log[this._log_idx][this._idx - 1];
        if (data.hule || data.pingju) this._view.update(data);
        return false;
    }

    autoplay() {
        if (this._summary && ! this._autoplay) return true;
        this._autoplay_timer = clearTimeout(this._autoplay_timer);
        this._autoplay = ! this._autoplay;
        const ctrl = $('.controller', this._root);
        if (this._autoplay) {
            hide($('.play.on'), ctrl);
            show($('.play.off'), ctrl);
        }
        else {
            hide($('.play.off'), ctrl);
            show($('.play.on'), ctrl);
        }
        if (this._autoplay) this.next();
        return false;
    }

    analyzer() {
        if (this._summary) return true;
        if (! this._analyzer) {
            if (this._autoplay) this.autoplay();
            this._analyzer = this._open_analyzer({ kaiju: {
                id:     this._view.viewpoint,
                rule:   Majiang.rule(),
                title:  this._paipu.title,
                player: this._paipu.player,
                qijia:  this._paipu.qijia
            }});
            if (this._log_idx < 0) {
                this._analyzer.active(false);
            }
            else {
                this.seek(this._log_idx, this._idx - 1);
                this._analyzer.active(true);
            }
        }
        else {
            this._analyzer.close();
            delete this._analyzer;
        }
        this.set_fragment();
        return false;
    }

    tenhou_dialog() {

        const set_data = ()=>{
            let type    = $('[name="type"]:checked', dialog).val();
            let log_idx = $('[name="limited"]', dialog).prop('checked')
                                                    ? this._log_idx : null;
            let data = '';
            if (type == 'JSON') {
                data = JSON.stringify(logconv(this._paipu, log_idx));
                $('textarea', dialog).attr('class','JSON');
            }
            else {
                for (let i = 0; i < this._paipu.log.length; i++) {
                    if (log_idx != null && i != log_idx) continue;
                    data += 'https://tenhou.net/6/#json='
                            + encodeURI(JSON.stringify(logconv(this._paipu, i)))
                            + '\n';
                }
                $('textarea', dialog).attr('class','URL');
            }
            $('textarea', dialog).val(data);
            if (! navigator.clipboard) {
                show($('[type="button"]', dialog));
                hide($('[type="submit"]', dialog));
                setTimeout(()=>
                    $('textarea', dialog).attr('disabled', false).select(),
                    20);
            }
            else {
                show($('[type="button"]', dialog));
                show($('[type="submit"]', dialog));
            }
        };
        const submit = ()=>{
            if (navigator.clipboard) {
                let data = $('textarea', dialog).val();
                navigator.clipboard.writeText(data);
            }
            close_dialog();
            return false;
        };
        const close_dialog = ()=>{
            hide(dialog);
            this.set_handler();
        };

        if (this._log_idx < 0) return;
        const dialog = $('.tenhou-dialog', this._root);
        this.clear_handler();

        $('form', dialog).off('submit').on('submit', submit);
        $('[type="button"]', dialog).off('click').on('click', close_dialog);
        $('input', dialog).off('change').on('change', set_data);

        show(dialog);
        set_data();
    }

    set_fragment(hash) {

        if (hash) {
            this._fragment_base = hash.replace(/\/.*$/,'');
        }
        else if (hash == '') {
            history.replaceState('', '', location.href.replace(/#.*$/,''));
        }
        else {
            if (! this._fragment_base) return;

            let state = [ this._view.viewpoint ];
            if (this._log_idx >= 0) {
                state.push(this._log_idx, this._idx - 1);
            }

            let opt = (this._view.open_shoupai ? ''  : 's')
                    + (this._view.open_he      ? ''  : 'h')
                    + (this._analyzer          ? 'i' : '' )
                    + (this._view.dummy_name != null
                                ? 'p' + this._view.dummy_name : '');

            let fragment = this._fragment_base + '/' +  state.join('/')
                         + (opt ? `:${opt}` : '');

            history.replaceState('', '', fragment);
        }
    }
}

// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {evaluate} from './calculator.js';

const CalculatorIndicator = GObject.registerClass(class CalculatorIndicator extends PanelMenu.Button {
    _onMenuKeyPress(...args) {
        if (global.stage.get_key_focus() instanceof Clutter.Text)
            return Clutter.EVENT_PROPAGATE;
        return super._onMenuKeyPress(...args);
    }
});

function makeButton(label, styleClass, callback) {
    const button = new St.Button({
        label,
        style_class: `calculator-button ${styleClass}`,
        can_focus: true,
        x_expand: true,
        y_expand: true,
    });
    button.connect('clicked', callback);
    return button;
}

export default class CalculatorExtension extends Extension {
    enable() {
        this.expression = '';
        this.result = '';
        this.settings = this.getSettings();
        this.buttons = [];

        this.indicator = new CalculatorIndicator(0.0, 'Top Bar Calculator');
        this.indicator.setMenu(new PopupMenu.PopupMenu(this.indicator, 0.0, St.Side.TOP));
        this.indicator.add_child(new St.Icon({
            icon_name: 'accessories-calculator-symbolic',
            style_class: 'system-status-icon',
        }));

        this.root = new St.BoxLayout({
            style_class: 'calculator-popup',
            orientation: Clutter.Orientation.VERTICAL,
            reactive: true,
            can_focus: true,
        });
        this.indicator.menu.focusActor = this.root;
        this.indicator.menu.box.add_child(this.root);

        const toolbar = new St.BoxLayout({style_class: 'calculator-row'});
        this.historyToggle = makeButton('History', 'calculator-toolbar', () => {
            this.historyPanel.visible = !this.historyPanel.visible;
            this.historyToggle.set_checked(this.historyPanel.visible);
        });
        this.historyToggle.toggle_mode = true;
        toolbar.add_child(this.historyToggle);
        toolbar.add_child(makeButton('Settings', 'calculator-toolbar', () => {
            this.indicator.menu.close();
            this.openPreferences();
        }));
        this.root.add_child(toolbar);

        this.expressionLabel = new St.Label({
            text: '',
            style_class: 'calculator-expression',
            x_align: Clutter.ActorAlign.FILL,
            x_expand: true,
        });
        this.display = new St.Label({
            text: '0',
            style_class: 'calculator-display',
            x_align: Clutter.ActorAlign.FILL,
            x_expand: true,
        });
        this.status = new St.Label({text: '', style_class: 'calculator-status'});
        for (const label of [this.expressionLabel, this.display]) {
            label.clutter_text.ellipsize = Pango.EllipsizeMode.START;
            label.clutter_text.set_line_alignment(Pango.Alignment.RIGHT);
        }
        this.root.add_child(this.expressionLabel);
        this.root.add_child(this.display);
        this.root.add_child(this.status);

        const rows = [
            [['C', 'clear'], ['(', 'operator'], [')', 'operator'], ['/', 'operator']],
            [['7', 'number'], ['8', 'number'], ['9', 'number'], ['*', 'operator']],
            [['4', 'number'], ['5', 'number'], ['6', 'number'], ['-', 'operator']],
            [['1', 'number'], ['2', 'number'], ['3', 'number'], ['+', 'operator']],
            [['0', 'number'], ['.', 'number'], ['Backspace', 'clear'], ['=', 'equals']],
        ];
        for (const row of rows) {
            const rowBox = new St.BoxLayout({style_class: 'calculator-row', x_expand: true});
            for (const [key, styleClass] of row) {
                const label = key === 'Backspace' ? '\u232b' : key;
                const button = makeButton(label, `calculator-${styleClass}`, () => this.press(key));
                button.accessible_name = key === 'Backspace' ? 'Backspace' : key;
                this.buttons.push(button);
                rowBox.add_child(button);
            }
            this.root.add_child(rowBox);
        }

        this.historyPanel = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'calculator-history',
            visible: false,
        });
        const historyHeader = new St.BoxLayout({style_class: 'calculator-row'});
        historyHeader.add_child(new St.Label({text: 'History', x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
        historyHeader.add_child(makeButton('Clear history', 'calculator-toolbar', () => {
            this.settings.reset('history');
        }));
        this.historyPanel.add_child(historyHeader);
        const scroll = new St.ScrollView({style_class: 'calculator-history-scroll', overlay_scrollbars: true});
        scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.historyList = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'calculator-history-list'});
        scroll.set_child(this.historyList);
        this.historyPanel.add_child(scroll);
        this.root.add_child(this.historyPanel);
        this.settingsChanged = this.settings.connect('changed', (_settings, key) => {
            if (key === 'history' || key === 'history-limit') {
                this._trimHistory();
                this._renderHistory();
            } else {
                this._applyFontSizes();
            }
        });
        this._trimHistory();
        this._renderHistory();
        this._applyFontSizes();

        this.keyController = new Clutter.KeyController();
        this.keyController.connect('key-press', () => this._onKeyPress());
        this.root.add_action_full('calculator-keyboard', Clutter.EventPhase.CAPTURE, this.keyController);
        this.menuStateChanged = this.indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this.root.grab_key_focus();
        });

        Main.panel.addToStatusArea(this.uuid, this.indicator);
    }

    disable() {
        this.settings.disconnect(this.settingsChanged);
        this.indicator.menu.disconnect(this.menuStateChanged);
        this.indicator.destroy();
        this.indicator = null;
        this.keyController = null;
        this.root = null;
        this.settings = null;
        this.buttons = null;
        this.display = null;
        this.expressionLabel = null;
        this.status = null;
        this.historyPanel = null;
        this.historyList = null;
        this.historyToggle = null;
    }

    _onKeyPress() {
        const [, symbol] = this.keyController.get_key();
        // History and toolbar buttons use Enter normally. Enter on the keypad
        // still calculates, including after clicking a digit with the mouse.
        if ((symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) &&
            global.stage.get_key_focus() instanceof St.Button &&
            !this.buttons.includes(global.stage.get_key_focus()))
            return Clutter.EVENT_PROPAGATE;
        const [, pressed, latched] = this.keyController.get_state();
        const shift = Boolean((pressed | latched) & Clutter.ModifierType.SHIFT_MASK);
        if ((pressed | latched) & (Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK | Clutter.ModifierType.SUPER_MASK))
            return Clutter.EVENT_PROPAGATE;
        let key = null;
        if (symbol === Clutter.KEY_parenleft || (shift && symbol === Clutter.KEY_9))
            key = '(';
        else if (symbol === Clutter.KEY_parenright || (shift && symbol === Clutter.KEY_0))
            key = ')';
        else if (symbol === Clutter.KEY_percent || (shift && symbol === Clutter.KEY_5))
            key = '%';
        else if (symbol >= Clutter.KEY_0 && symbol <= Clutter.KEY_9)
            key = String.fromCharCode(symbol);
        else if (symbol >= Clutter.KEY_KP_0 && symbol <= Clutter.KEY_KP_9)
            key = String(symbol - Clutter.KEY_KP_0);
        else if (symbol === Clutter.KEY_period || symbol === Clutter.KEY_KP_Decimal)
            key = '.';
        else if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter)
            key = '=';
        else if (symbol === Clutter.KEY_BackSpace || symbol === Clutter.KEY_Delete)
            key = 'Backspace';
        else if (symbol === Clutter.KEY_Escape) {
            this.indicator.menu.close();
            return Clutter.EVENT_STOP;
        } else if (symbol === Clutter.KEY_plus || symbol === Clutter.KEY_KP_Add || (shift && symbol === Clutter.KEY_equal))
            key = '+';
        else if (symbol === Clutter.KEY_minus || symbol === Clutter.KEY_KP_Subtract)
            key = '-';
        else if (symbol === Clutter.KEY_asterisk || symbol === Clutter.KEY_KP_Multiply)
            key = '*';
        else if (symbol === Clutter.KEY_slash || symbol === Clutter.KEY_KP_Divide)
            key = '/';
        else if (symbol === Clutter.KEY_equal)
            key = '=';
        else if (symbol === Clutter.KEY_c || symbol === Clutter.KEY_C)
            key = 'C';

        if (!key)
            return Clutter.EVENT_PROPAGATE;
        this.press(key);
        return Clutter.EVENT_STOP;
    }

    press(key) {
        this.status.text = '';
        if (key === 'C') {
            this.expression = '';
            this.result = '';
        } else if (key === 'Backspace') {
            this.expression = this.expression.slice(0, -1);
            this.result = '';
        } else if (key === '=') {
            if (!this.expression)
                return;
            try {
                this.result = evaluate(this.expression);
                const history = this.settings.get_value('history').deep_unpack();
                if (history[0]?.[0] !== this.expression || history[0]?.[1] !== this.result) {
                    history.unshift([this.expression, this.result]);
                    this.settings.set_value('history', new GLib.Variant('a(ss)', history.slice(0, this.settings.get_int('history-limit'))));
                }
            } catch (error) {
                this.result = '';
                this.status.text = error.message;
            }
        } else {
            if (this.result)
                this.expression = /^[+\-*/%]/.test(key) ? `${this.result}${key}` : key;
            else if (this.expression.length < 512)
                this.expression += key;
            else
                this.status.text = 'Expression is too long (maximum 512 characters)';
            this.result = '';
        }
        this._updateDisplay();
    }

    _updateDisplay() {
        this.expressionLabel.text = this.result ? this.expression : '';
        this.display.text = this.result || this.expression || '0';
    }

    _applyFontSizes() {
        const displaySize = this.settings.get_int('display-font-size');
        const buttonSize = this.settings.get_int('button-font-size');
        const historySize = this.settings.get_int('history-font-size');
        this.root.set_style(`width: ${Math.max(340, displaySize * 10, buttonSize * 15, historySize * 17)}px; font-size: ${historySize}pt;`);
        this.display.set_style(`font-size: ${displaySize}pt;`);
        this.expressionLabel.set_style(`font-size: ${historySize}pt;`);
        for (const button of this.buttons)
            button.set_style(`font-size: ${buttonSize}pt;`);
        this.historyPanel.set_style(`font-size: ${historySize}pt;`);
    }

    _trimHistory() {
        const history = this.settings.get_value('history').deep_unpack();
        const limit = this.settings.get_int('history-limit');
        if (history.length > limit)
            this.settings.set_value('history', new GLib.Variant('a(ss)', history.slice(0, limit)));
    }

    _renderHistory() {
        this.historyList.destroy_all_children();
        const history = this.settings.get_value('history').deep_unpack();
        if (!history.length)
            this.historyList.add_child(new St.Label({text: 'No calculations yet.', style_class: 'calculator-history-empty'}));
        for (const [expression, result] of history) {
            const button = new St.Button({
                style_class: 'calculator-history-item',
                can_focus: true,
                x_expand: true,
                accessible_name: `${expression} equals ${result}. Reuse calculation`,
            });
            const box = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL});
            box.add_child(new St.Label({text: expression, style_class: 'calculator-history-expression'}));
            box.add_child(new St.Label({text: `= ${result}`, style_class: 'calculator-history-result'}));
            button.set_child(box);
            button.connect('clicked', () => {
                this.expression = expression;
                this.result = result;
                this.status.text = '';
                this._updateDisplay();
                this.root.grab_key_focus();
            });
            this.historyList.add_child(button);
        }
    }

}

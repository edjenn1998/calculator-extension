// SPDX-License-Identifier: GPL-3.0-or-later
// Exercise extension state transitions without requiring a running GNOME Shell.
// These doubles do not replace the on-desktop visual/API smoke test.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {evaluate} from '../calculator.js';

class Actor {
    constructor(properties = {}) {
        Object.assign(this, properties);
        this.children = [];
        this.signals = {};
        this.actions = [];
        this.clutter_text = {set_line_alignment() {}};
    }
    add_child(child) { this.children.push(child); child.parent = this; }
    set_child(child) { this.add_child(child); }
    connect(name, callback) { this.signals[name] = callback; return name; }
    disconnect(id) { delete this.signals[id]; }
    connectObject(name, callback, owner) {
        const id = this.connect(name, callback);
        owner.connect('destroy', () => this.disconnect(id));
    }
    destroy_all_children() {
        for (const child of [...this.children])
            child.destroy();
    }
    destroy() {
        assert.equal(this.destroyed, undefined, 'Actor destroyed twice');
        this.signals.destroy?.();
        this.destroy_all_children();
        this.signals = {};
        this.actions = [];
        if (this.parent)
            this.parent.children = this.parent.children.filter(child => child !== this);
        this.destroyed = true;
    }
    setMenu(menu) { this.menu = menu; this.add_child(menu); }
    set_policy() {}
    add_action_full(_name, _phase, action) { this.actions.push(action); }
    set_style(style) { this.style = style; }
    grab_key_focus() { this.focused = true; }
}
class Button extends Actor {}
class Menu extends Actor {
    constructor() {
        super();
        this.box = new Actor();
        this.add_child(this.box);
    }
}
class Variant {
    constructor(_type, value) { this.value = value; }
    deep_unpack() { return structuredClone(this.value); }
}
const Clutter = {
    KEY_0: 48, KEY_9: 57, KEY_5: 53, KEY_Return: 65293,
    KEY_parenleft: 40, KEY_parenright: 41, KEY_percent: 37,
    KEY_equal: 61, KEY_KP_Add: 65451,
    ModifierType: {SHIFT_MASK: 1, CONTROL_MASK: 4, MOD1_MASK: 8, SUPER_MASK: 64},
    EVENT_PROPAGATE: false, EVENT_STOP: true,
    Orientation: {VERTICAL: 1},
    ActorAlign: {FILL: 0, CENTER: 1}, EventPhase: {CAPTURE: 0},
    KeyController: Actor,
};
let focus = null;
const source = readFileSync(new URL('../extension.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export default class', 'class');
const CalculatorExtension = vm.runInNewContext(`${source}\nCalculatorExtension;`, {
    Clutter, GLib: {Variant}, GObject: {registerClass: value => value},
    St: {
        Button, BoxLayout: Actor, Label: Actor, Icon: Actor, ScrollView: Actor,
        Side: {TOP: 0}, PolicyType: {NEVER: 0, AUTOMATIC: 1},
    },
    PanelMenu: {Button: Actor}, PopupMenu: {PopupMenu: Menu},
    Pango: {EllipsizeMode: {START: 0}, Alignment: {RIGHT: 1}},
    Main: {panel: {addToStatusArea() {}}},
    Extension: class {}, evaluate, global: {stage: {get_key_focus: () => focus}},
});

function calculator() {
    const extension = new CalculatorExtension();
    const data = {
        history: [], 'history-limit': 50,
        'display-font-size': 28, 'button-font-size': 18, 'history-font-size': 14,
    };
    extension.settings = {
        get_int: key => data[key],
        get_value: key => new Variant(null, data[key]),
        set_value: (key, variant) => { data[key] = variant.deep_unpack(); },
    };
    Object.assign(extension, {
        expression: '', result: '', status: new Actor(), display: new Actor(),
        expressionLabel: new Actor(), root: new Actor(), historyList: new Actor(),
        historyPanel: new Actor(), buttons: [new Button()],
    });
    return {extension, data};
}

test('enable and disable release the UI and signals across repeated cycles', () => {
    const calc = new CalculatorExtension();
    const {extension: saved} = calculator();
    const settings = new Actor();
    Object.assign(settings, saved.settings);
    calc.getSettings = () => settings;

    for (let cycle = 0; cycle < 2; cycle++) {
        calc.enable();
        const indicator = calc.indicator;
        const root = calc.root;
        const controller = root.actions[0];
        const actors = [];
        function collect(actor) {
            actors.push(actor);
            actor.children.forEach(collect);
        }
        collect(indicator);
        assert.equal(typeof controller.signals['key-press'], 'function');
        indicator.menu.signals['open-state-changed'](indicator.menu, true);
        assert.equal(root.focused, true);
        settings.signals.changed(settings, 'display-font-size');

        calc.disable();

        assert.ok(actors.every(actor => actor.destroyed));
        assert.deepEqual(settings.signals, {});
        assert.deepEqual(controller.signals, {});
        assert.equal(indicator.menu.focusActor, null);
        for (const field of [
            'indicator', 'root', 'settings', 'buttons', 'display', 'expressionLabel',
            'status', 'historyPanel', 'historyList', 'historyToggle',
        ])
            assert.equal(calc[field], null, `${field} still holds a reference`);
    }
});

test('successful results persist, repeated equals is deduplicated, and errors are not saved', () => {
    const {extension: calc, data} = calculator();
    for (const key of ['2', '+', '3', '=', '='])
        calc.press(key);
    assert.equal(calc.display.text, '5');
    assert.equal(JSON.stringify(data.history), JSON.stringify([['2+3', '5']]));
    calc.press('*');
    calc.press('4');
    calc.press('=');
    assert.equal(calc.result, '20');
    assert.equal(data.history[0][0], '5*4');
    calc.press('/');
    calc.press('0');
    calc.press('=');
    assert.match(calc.status.text, /zero/);
    assert.equal(data.history.length, 2);
    calc.press('C');
    assert.equal(calc.display.text, '0');
    assert.equal(data.history.length, 2);
});

test('history survives a new instance, recalls answers, and keeps the newest entries', () => {
    const {extension: calc, data} = calculator();
    data['history-limit'] = 10;
    for (let i = 0; i < 12; i++) {
        calc.expression = `${i}+1`;
        calc.press('=');
    }
    assert.equal(data.history.length, 10);
    assert.equal(data.history[0][0], '11+1');
    assert.equal(data.history[9][0], '2+1');
    const restored = calculator().extension;
    restored.settings = calc.settings;
    restored._renderHistory();
    restored.historyList.children[0].signals.clicked();
    assert.equal(restored.display.text, '12');
    assert.equal(restored.expressionLabel.text, '11+1');
    restored.press('+');
    restored.press('1');
    restored.press('=');
    assert.equal(restored.result, '13');
    data.history = [];
    restored._renderHistory();
    assert.equal(restored.historyList.children[0].text, 'No calculations yet.');
});

test('font changes update each text group and make room for larger fonts', () => {
    const {extension: calc, data} = calculator();
    calc._applyFontSizes();
    assert.match(calc.display.style, /28pt/);
    assert.match(calc.buttons[0].style, /18pt/);
    data['display-font-size'] = 48;
    data['history-font-size'] = 24;
    calc._applyFontSizes();
    assert.match(calc.display.style, /48pt/);
    assert.match(calc.historyPanel.style, /24pt/);
    assert.match(calc.root.style, /width: 480px/);
});

test('parentheses, shifted digits, keypad addition, equals, and modifier shortcuts', () => {
    const {extension: calc} = calculator();
    let symbol;
    let modifiers = 0;
    const controller = {get_key: () => [true, symbol], get_state: () => [true, modifiers, 0]};
    focus = null;
    for (symbol of [Clutter.KEY_parenleft, Clutter.KEY_9, Clutter.KEY_parenright, Clutter.KEY_KP_Add, Clutter.KEY_5, Clutter.KEY_equal])
        assert.equal(calc._onKeyPress(controller), Clutter.EVENT_STOP);
    assert.equal(calc.result, '14');
    calc.press('C');
    modifiers = Clutter.ModifierType.SHIFT_MASK;
    symbol = Clutter.KEY_9;
    calc._onKeyPress(controller);
    assert.equal(calc.expression, '(');
    modifiers = Clutter.ModifierType.CONTROL_MASK;
    symbol = Clutter.KEY_5;
    assert.equal(calc._onKeyPress(controller), Clutter.EVENT_PROPAGATE);
    assert.equal(calc.expression, '(');
    modifiers = 0;
    symbol = Clutter.KEY_Return;
    focus = new Button();
    assert.equal(calc._onKeyPress(controller), Clutter.EVENT_PROPAGATE);
    focus = calc.buttons[0];
    assert.equal(calc._onKeyPress(controller), Clutter.EVENT_STOP);
    focus = null;
});

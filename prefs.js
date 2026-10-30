// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class CalculatorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'Calculator', icon_name: 'accessories-calculator-symbolic'});
        const fonts = new Adw.PreferencesGroup({
            title: 'Text size',
            description: 'Sizes are in points and apply immediately. The calculator widens to fit larger text.',
        });
        for (const [key, title, subtitle, lower, upper] of [
            ['display-font-size', 'Display', 'Current input and calculated result', 18, 48],
            ['button-font-size', 'Keypad', 'Numbers and operator buttons', 12, 32],
            ['history-font-size', 'Supporting text', 'History, previous expression, toolbar, and messages', 10, 24],
        ]) {
            fonts.add(this._spinRow(settings, key, title, subtitle, lower, upper));
        }
        const reset = new Gtk.Button({label: 'Reset text sizes', valign: Gtk.Align.CENTER});
        reset.connect('clicked', () => {
            for (const key of ['display-font-size', 'button-font-size', 'history-font-size'])
                settings.reset(key);
        });
        const resetRow = new Adw.ActionRow({title: 'Restore larger default sizes'});
        resetRow.add_suffix(reset);
        fonts.add(resetRow);
        page.add(fonts);

        const history = new Adw.PreferencesGroup({
            title: 'Calculation history',
            description: 'Saved locally across logins. Open History in the calculator and select an entry to reuse its answer.',
        });
        history.add(this._spinRow(settings, 'history-limit', 'Saved calculations',
            'Reducing this limit removes the oldest entries when the extension is enabled.', 10, 100));
        const clear = new Gtk.Button({label: 'Clear history', valign: Gtk.Align.CENTER, css_classes: ['destructive-action']});
        clear.connect('clicked', () => settings.reset('history'));
        const clearRow = new Adw.ActionRow({title: 'Remove all saved calculations'});
        clearRow.add_suffix(clear);
        history.add(clearRow);
        page.add(history);
        window.add(page);
    }

    _spinRow(settings, key, title, subtitle, lower, upper) {
        const row = new Adw.SpinRow({
            title,
            subtitle,
            adjustment: new Gtk.Adjustment({lower, upper, step_increment: 1, page_increment: 5}),
            digits: 0,
        });
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }
}

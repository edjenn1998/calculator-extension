# Top Bar Calculator

A GNOME Shell **51** extension with a calculator in the top bar, larger readable
text, adjustable fonts, mouse/keyboard input, and persistent calculation history.

![Top Bar Calculator running in GNOME Shell](Screenshots/Screenshot%20From%202026-10-30%2010-28-08.png)

## Install

Requires **GNOME Shell 51**.

Download `calculator-extension@edjenn1998.github.io.shell-extension.zip` from the
[latest release](https://github.com/edjenn1998/calculator-extension/releases/latest).
Open a terminal in the folder containing the downloaded ZIP and run:

```sh
gnome-extensions install --force calculator-extension@edjenn1998.github.io.shell-extension.zip
```

If building from source, `npm run pack` creates the archive in **`dist/`**:

```sh
gnome-extensions install --force dist/calculator-extension@edjenn1998.github.io.shell-extension.zip
```

Log out and back in after installing or updating, then enable it:

```sh
gnome-extensions enable calculator-extension@edjenn1998.github.io
```

The ZIP contains the extension files at its root and a compiled settings schema;
no build tools are needed on the machine where you install it.

## Text sizes

Open the calculator and select **Settings**, or use its preferences in the
Extensions app. Each size can be adjusted independently and applies immediately:

| Setting | Default | Range |
| --- | --- | --- |
| Display (input and result) | 28 pt | 18–48 pt |
| Keypad | 18 pt | 12–32 pt |
| Supporting text (history, expression, toolbar, messages) | 14 pt | 10–24 pt |

The popup widens with larger fonts. **Reset text sizes** restores these defaults.

## History

Select **History** to show/hide the scrollable list, newest calculation first.
Successful calculations are saved locally in GSettings and survive logout and
extension reloads. The default limit is 50 entries (adjustable from 10 to 100).
Repeated evaluation of the same latest calculation does not add a duplicate.

Select an entry to restore its expression and answer. Type an operator to continue
from that answer, type a number to start fresh, or press Backspace to edit the
original expression. **Clear history** is available in the popup and preferences;
the keypad's **C** only clears the current calculation.

## Input

- Mouse buttons or keyboard digits, decimal point, `+`, `-`, `*`, `/`, and parentheses.
- Enter, keypad Enter, or `=` calculates. Keypad numbers and operators work too.
- Backspace/Delete removes the last character; `C` clears; Escape closes the popup.
- Keyboard `%` is **remainder**, not percentage (for example, `10%3` is `1`).
- Standard operator precedence and unary signs are supported. Results are rounded
  to 12 significant digits; scientific-notation results can be used in subsequent
  calculations. Input is limited to 512 characters.
- Tab moves between controls; Space activates the focused button. Enter activates
  history/toolbar buttons, or calculates when focus is on the keypad/display.

## Project layout and development

```text
extension.js       GNOME panel, keypad, keyboard input, and history UI
calculator.js      Arithmetic parser (no eval)
prefs.js           Native GNOME preferences
schemas/           GSettings definitions
stylesheet.css     Theme-aware calculator styling
tests/             Arithmetic regression tests
tools/package.py   Builds and verifies the installable archive
dist/              Ready-to-install ZIP (generated)
```

With Node.js, Python 3, and `glib-compile-schemas` installed:

```sh
npm run check
npm run pack
```

No npm dependencies are needed. To run directly from the source folder, compile
the schema with `glib-compile-schemas schemas` first and copy the runtime files
and `schemas/` into the extension's UUID directory under
`~/.local/share/gnome-shell/extensions/`.

Licensed under GPL-3.0-or-later; see `LICENSE`.

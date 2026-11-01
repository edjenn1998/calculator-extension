#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Build a flat GNOME extension ZIP and validate its GSettings schema."""
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = 'org.gnome.shell.extensions.calculator.gschema.xml'
FILES = (
    'extension.js', 'calculator.js', 'prefs.js', 'metadata.json',
    'stylesheet.css', f'schemas/{SCHEMA}', 'LICENSE', 'COPYING',
)


def main():
    metadata = json.loads((ROOT / 'metadata.json').read_text())
    output = ROOT / 'dist' / f"{metadata['uuid']}.shell-extension.zip"
    output.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='calculator-pack-') as temp:
        schema_dir = Path(temp)
        (schema_dir / SCHEMA).write_bytes((ROOT / 'schemas' / SCHEMA).read_bytes())
        subprocess.run(['glib-compile-schemas', '--strict', str(schema_dir)], check=True)
        # Build outside dist first, so a failed build cannot replace a good ZIP.
        archive_path = schema_dir / output.name
        with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name in FILES:
                archive.write(ROOT / name, name)
        with zipfile.ZipFile(archive_path) as archive:
            if archive.testzip() is not None:
                raise RuntimeError('ZIP integrity check failed')
            if set(archive.namelist()) != set(FILES):
                raise RuntimeError('Unexpected ZIP contents')
        output.write_bytes(archive_path.read_bytes())
    print(f'Created and verified {output}')


if __name__ == '__main__':
    main()

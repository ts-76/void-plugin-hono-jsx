import assert from 'node:assert/strict';
import path from 'node:path';

// Read through the archive's file table; never resolve map references on the host.
export function inspectSourceMaps(contents) {
  const files = [...contents.keys()];
  assert.ok(files.some(file => file.startsWith('src/')), 'Package source files missing');
  for (const file of files.filter(file => file.startsWith('dist/') && !file.endsWith('.map'))) {
    const mapFile = file + '.map';
    assert.ok(contents.has(mapFile), `Missing map: ${mapFile}`);
    const code = contents.get(file);
    const references = [...code.matchAll(/^\/\/# sourceMappingURL=(.+)$/gm)];
    assert.equal(references.length, 1, `Expected one map reference: ${file}`);
    assert.equal(references[0][1], path.posix.basename(mapFile), `Unexpected map reference: ${file}`);
  }
  for (const file of files.filter(file => file.endsWith('.map'))) {
    const target = file.slice(0, -4);
    assert.ok(contents.has(target), `Orphan map: ${file}`);
    const map = JSON.parse(contents.get(file));
    assert.equal(map.version, 3, `Invalid map version: ${file}`);
    assert.equal(map.file, path.posix.basename(target), `Map output mismatch: ${file}`);
    assert.ok(!map.sourceRoot && !map.sections, `Unsupported map roots/sections: ${file}`);
    assert.ok(Array.isArray(map.sources) && map.sources.length > 0, `Missing map sources: ${file}`);
    assert.ok(typeof map.mappings === 'string' && map.mappings.length > 0, `Missing map positions: ${file}`);
    const sources = map.sources.map((source, index) => {
      assert.equal(typeof source, 'string');
      assert.ok(source && !/[:\\%?#]/.test(source) && !path.posix.isAbsolute(source), `Unsafe map source: ${file}`);
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), source));
      assert.ok(resolved.startsWith('src/') && contents.has(resolved), `Map source outside packaged src: ${file}`);
      const text = contents.get(resolved);
      if (target.endsWith('.js')) {
        assert.equal(map.sourcesContent?.[index], text, `Embedded map source differs: ${file}`);
      } else if (map.sourcesContent?.[index] != null) {
        assert.equal(map.sourcesContent[index], text, `Embedded declaration source differs: ${file}`);
      }
      return text.split('\n');
    });
    const generated = contents.get(target).split('\n');
    let mapped = 0;
    for (const [line, segment] of sourcePositions(map.mappings, map.names)) {
        assert.ok(line < generated.length && segment[0] <= generated[line].length, `Generated map position outside output: ${file}`);
        if (segment.length < 4) continue;
        const sourceLines = sources[segment[1]];
        assert.ok(sourceLines && segment[2] >= 0 && segment[2] < sourceLines.length && segment[3] >= 0 && segment[3] <= sourceLines[segment[2]].length, `Original map position outside source: ${file}`);
        mapped++;
    }
    assert.ok(mapped > 0, `No mapped source positions: ${file}`);
  }
}

// Source-map v3 Base64 VLQ; keep stage inspection independent of npm installs.
function* sourcePositions(mappings, names = []) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let source = 0, originalLine = 0, originalColumn = 0, name = 0;
  for (const [line, encodedLine] of mappings.split(';').entries()) {
    let column = 0;
    if (!encodedLine) continue;
    for (const encoded of encodedLine.split(',')) {
      const fields = [];
      let value = 0, factor = 1;
      assert.ok(encoded.length, 'Empty map segment');
      for (const character of encoded) {
        const digit = alphabet.indexOf(character);
        assert.ok(digit >= 0, 'Invalid map VLQ character');
        value += (digit % 32) * factor;
        assert.ok(Number.isSafeInteger(value) && factor <= 2 ** 50, 'Map VLQ overflow');
        if (digit >= 32) factor *= 32;
        else {
          fields.push((value % 2 ? -1 : 1) * Math.floor(value / 2));
          value = 0; factor = 1;
        }
      }
      assert.equal(factor, 1, 'Unterminated map VLQ');
      assert.ok([1, 4, 5].includes(fields.length), 'Invalid map segment fields');
      column += fields[0];
      assert.ok(column >= 0 && fields[0] >= 0, 'Map columns must be ordered');
      if (fields.length === 1) { yield [line, [column]]; continue; }
      source += fields[1]; originalLine += fields[2]; originalColumn += fields[3];
      assert.ok(source >= 0, 'Invalid map source index');
      if (fields.length === 5) {
        name += fields[4];
        assert.ok(name >= 0 && name < names.length, 'Invalid map name index');
      }
      yield [line, [column, source, originalLine, originalColumn]];
    }
  }
}

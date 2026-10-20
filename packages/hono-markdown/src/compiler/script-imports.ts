import { parse } from '@babel/parser';
export function parseSync(filename: string, source: string) {
  try { return { program: parse(source, { sourceType: 'module', sourceFilename: filename, plugins: ['typescript', 'importAttributes'] }).program, errors: [] as Error[] }; }
  catch (error) { return { program: { body: [] as ReturnType<typeof parse>['program']['body'] }, errors: [error as Error] }; }
}
export function findIslandImports(source: string, filename: string) {
  const parsed = parseSync(filename, source);
  return parsed.program.body.flatMap(node => {
    if (node.type !== 'ImportDeclaration') return [];
    const attributes = node.attributes ?? [];
    const island = attributes.find(attribute => ('name' in attribute.key ? attribute.key.name : attribute.key.value) === 'island');
    if (!island || attributes.length !== 1 || node.specifiers.length !== 1 || node.specifiers[0].type !== 'ImportDefaultSpecifier' || node.importKind === 'type' || !/^[A-Z]\w*$/.test(node.specifiers[0].local.name)) return [];
    return [{ start: node.start!, end: node.end!, specifier: node.source.value, importName: node.specifiers[0].local.name, hydrate: island.value.value }];
  });
}
export function editIslandSource(source: string, edits: { start: number; end: number; text: string }[]) {
  let code = source;
  for (const edit of [...edits].sort((a,b) => b.start-a.start)) code = code.slice(0,edit.start)+edit.text+code.slice(edit.end);
  return { code };
}

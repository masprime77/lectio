// Slug-based unique semester ids, mirroring packages/desktop/app.js.
export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'semester';
}

export function uniqueSemesterId(name: string, existingIds: Set<string>): string {
  let id = slugify(name);
  let n = 2;
  while (existingIds.has(id)) id = `${slugify(name)}-${n++}`;
  return id;
}

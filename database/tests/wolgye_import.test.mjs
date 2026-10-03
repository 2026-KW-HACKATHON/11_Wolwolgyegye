import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const readSql = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('후보 851곳은 기본 비공개이고, 전체 공개 SQL은 해당 후보만 반복해서 공개한다', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readSql('./bootstrap.sql'));
    const migrations = new URL('../supabase/migrations/', import.meta.url);
    for (const name of (await readdir(migrations)).filter((file) => file.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(name, migrations), 'utf8'));
    }
    const importSql = await readSql('../imports/wolgye1-stores-import.sql');
    await db.exec(importSql);
    await db.exec(importSql);
    const before = await db.query('select count(*)::integer as total, count(*) filter (where is_published)::integer as published from public.stores');
    assert.deepEqual(before.rows[0], { total: 851, published: 0 });

    await db.exec(await readSql('../imports/wolgye1-publish-pasmal.sql'));
    const after = await db.query('select count(*)::integer as total, count(*) filter (where is_published)::integer as published from public.stores');
    assert.deepEqual(after.rows[0], { total: 851, published: 1 });

    await db.exec('begin; set local role anon;');
    const visible = await db.query('select name, cuisine_type from public.stores');
    await db.exec('rollback');
    assert.deepEqual(visible.rows, [{ name: '빠말Pasmal', cuisine_type: '베이커리' }]);

    const publishAllSql = await readSql('../imports/wolgye1-publish-all-candidates.sql');
    await db.exec(publishAllSql);
    await db.exec(publishAllSql);
    await db.exec('begin; set local role anon;');
    const allVisible = await db.query('select count(*)::integer as count from public.stores');
    await db.exec('rollback');
    assert.equal(allVisible.rows[0].count, 851);
  } finally {
    await db.close();
  }
});

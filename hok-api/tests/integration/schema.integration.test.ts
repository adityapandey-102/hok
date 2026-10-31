import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../src/common/database/drizzle-client";
import { closeDb } from "./helpers";

/**
 * Schema rules checked against the real local database (the migrations as
 * applied), so a new table can't quietly break them.
 */
afterAll(async () => {
  await closeDb();
});

describe("schema", () => {
  it("every foreign key is covered by an index (engineering-practices §1)", async () => {
    // Postgres doesn't index the referencing side of a foreign key on its own:
    // without one, deleting or SET-NULLing a parent row scans the whole child table.
    // Covered = an index whose leading columns are exactly the key's columns (any
    // order), or a unique index (e.g. the primary key) entirely inside the key's
    // columns -- then the lookup is a single indexed row anyway.
    const res = await db.execute(sql`
      select c.conrelid::regclass::text as tbl, c.conname as constraint_name
      from pg_constraint c
      where c.contype = 'f'
        and c.connamespace = 'public'::regnamespace
        and not exists (
          select 1 from pg_index i
          where i.indrelid = c.conrelid
            and (
              (select array_agg(x order by x) from unnest((i.indkey::int2[])[0:array_length(c.conkey, 1) - 1]) x)
                = (select array_agg(x order by x) from unnest(c.conkey) x)
              or (i.indisunique and (i.indkey::int2[]) <@ c.conkey)
            )
        )
      order by 1, 2`);
    expect(res.rows, "foreign keys without an index").toEqual([]);
  });
});

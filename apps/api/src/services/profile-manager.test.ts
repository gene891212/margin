import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@wct/db/migrate";
import { ProfileManager } from "./profile-manager.js";

let tempDirectory: string | undefined;
afterEach(() => {
  if (tempDirectory) rmSync(tempDirectory, { recursive: true, force: true });
  tempDirectory = undefined;
});

describe("ProfileManager (Singleton)", () => {
  it("initializes default profile state", async () => {
    tempDirectory = mkdtempSync(join(tmpdir(), "margin-pm-test-"));
    const dbFile = join(tempDirectory, "app.sqlite");
    const { db, client } = migrateDatabase(dbFile);

    const manager = new ProfileManager(db, tempDirectory);
    const state = await manager.getState();
    expect(state.status).toBe("new");
    expect(state.busy).toBe(false);
    expect(state.lastUsedAt).toBeNull();
    client.close();
  });

  it("resets profile state and cleans storage", async () => {
    tempDirectory = mkdtempSync(join(tmpdir(), "margin-pm-test-"));
    const dbFile = join(tempDirectory, "app.sqlite");
    const { db, client } = migrateDatabase(dbFile);

    const manager = new ProfileManager(db, tempDirectory);
    await manager.getState();

    const resetState = await manager.reset();
    expect(resetState.status).toBe("new");
    expect(resetState.busy).toBe(false);
    client.close();
  });
});

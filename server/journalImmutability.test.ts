import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");
const journalSource = routerSource.slice(
  routerSource.indexOf("const journalRouter = router({"),
  routerSource.indexOf("// ───", routerSource.indexOf("const journalRouter = router({") + 1),
);
const bulkSource = readFileSync(resolve(import.meta.dirname, "journalBulkProcedures.ts"), "utf8");
const mutationSource = readFileSync(resolve(import.meta.dirname, "journalMutationProcedures.ts"), "utf8");

describe("GeBüV-Immobilität verbuchter Journaleinträge", () => {
  it("blockiert das Zurücksetzen einzelner genehmigter Buchungen serverseitig", () => {
    const revertSource = mutationSource.slice(mutationSource.indexOf("revert:"), mutationSource.indexOf("reverse:"));

    expect(revertSource).toContain('code: "FORBIDDEN"');
    expect(revertSource).toContain("Stornobuchung");
    expect(revertSource).not.toContain('status: "pending", approvedBy: null');
  });

  it("blockiert auch das Zurücksetzen mehrerer genehmigter Buchungen", () => {
    const bulkRevertSource = bulkSource.slice(bulkSource.indexOf("bulkRevert:"));

    expect(bulkRevertSource).toContain('code: "FORBIDDEN"');
    expect(bulkRevertSource).toContain("Stornobuchung");
    expect(bulkRevertSource).not.toContain('status: "pending", approvedBy: null');
  });
});

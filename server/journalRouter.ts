import { router } from "./_core/trpc";
import { journalBulkProcedures } from "./journalBulkProcedures";
import { journalCommandProcedures } from "./journalCommandProcedures";
import { journalCsvProcedures } from "./journalCsvProcedures";
import { journalInfoniqaProcedures } from "./journalInfoniqaProcedures";
import { journalMutationProcedures } from "./journalMutationProcedures";
import { journalQueryProcedures } from "./journalQueryProcedures";

export const journalRouter = router({
  ...journalQueryProcedures,
  ...journalCommandProcedures,
  ...journalMutationProcedures,
  ...journalBulkProcedures,
  ...journalCsvProcedures,
  ...journalInfoniqaProcedures,
});

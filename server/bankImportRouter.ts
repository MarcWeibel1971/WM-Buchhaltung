import { router } from "./_core/trpc";
import { bankImportAccountProcedures } from "./bankImportAccountProcedures";
import { bankImportSnapshotProcedures } from "./bankImportSnapshotProcedures";
import { bankImportMaintenanceProcedures } from "./bankImportMaintenanceProcedures";
import { bankImportHistoryProcedures } from "./bankImportHistoryProcedures";
import { bankImportIngestionProcedures } from "./bankImportIngestionProcedures";
import { bankImportCategorizationProcedures } from "./bankImportCategorizationProcedures";
import { bankImportStatusProcedures } from "./bankImportStatusProcedures";
import { bankImportApprovalProcedures } from "./bankImportApprovalProcedures";
import { bankImportBookingTextProcedures } from "./bankImportBookingTextProcedures";
import { bankImportTransferDetectionProcedures } from "./bankImportTransferDetectionProcedures";
import { bankImportListingProcedures } from "./bankImportListingProcedures";
import { bankImportTransferApprovalProcedures } from "./bankImportTransferApprovalProcedures";
import { bankImportRefreshProcedures } from "./bankImportRefreshProcedures";

export const bankImportRouter = router({
  ...bankImportAccountProcedures,
  ...bankImportSnapshotProcedures,
  ...bankImportMaintenanceProcedures,
  ...bankImportHistoryProcedures,
  ...bankImportIngestionProcedures,
  ...bankImportCategorizationProcedures,
  ...bankImportStatusProcedures,
  ...bankImportApprovalProcedures,
  ...bankImportBookingTextProcedures,
  ...bankImportTransferDetectionProcedures,
  ...bankImportListingProcedures,
  ...bankImportTransferApprovalProcedures,
  ...bankImportRefreshProcedures,
});

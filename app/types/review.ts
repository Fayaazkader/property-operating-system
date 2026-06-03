import {
  ImportedTransaction,
} from "./finance";

export type TransactionReviewState = {
  selectedTransaction:
    ImportedTransaction | null;

  reviewOpen: boolean;
};
export type WorkflowActivity = {
  id: string;

  label: string;

  timestamp: string;

  type:
    | "import"
    | "match"
    | "review"
    | "allocation"
    | "approval";
};
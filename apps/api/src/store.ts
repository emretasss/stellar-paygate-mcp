import type { PayGateReceipt } from "@stellar-paygate/shared";

export interface DisputeRecord {
  id: string;
  receiptId: string;
  reason: string;
  status: "open" | "resolved";
  createdAt: string;
}

const receipts: PayGateReceipt[] = [];
const disputes: DisputeRecord[] = [];

export function addReceipt(receipt: PayGateReceipt): PayGateReceipt {
  receipts.unshift(receipt);
  return receipt;
}

export function listReceipts(): PayGateReceipt[] {
  return receipts.slice(0, 50);
}

export function addDispute(receiptId: string, reason: string): DisputeRecord {
  const dispute: DisputeRecord = {
    id: `dispute-${receipts.length + disputes.length + 1}`,
    receiptId,
    reason,
    status: "open",
    createdAt: new Date().toISOString()
  };
  disputes.unshift(dispute);
  return dispute;
}

export function listDisputes(): DisputeRecord[] {
  return disputes.slice(0, 50);
}

export function clearStoreForTests(): void {
  receipts.splice(0, receipts.length);
  disputes.splice(0, disputes.length);
}

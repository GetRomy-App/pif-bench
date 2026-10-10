# Kestrel Valley Food Bank — Gift Processing Standards

Finance & Development Operations · rev. 2025-07 · approved by the Controller

## 1. Fiscal year

Our fiscal year runs **July 1 to June 30** and is named for the calendar year in which it ends. FY2026 ended June 30, 2026; FY2027 began July 1, 2026.

## 2. Gift dates

| How the gift came in | Gift date |
|---|---|
| Check or cash by mail | The **postmark date** for envelopes received July 1–15 (the year-end window, when the postmark decides the fiscal year); otherwise the date received |
| Check or cash delivered by hand | The date received |
| Card or online (PayBridge) | The PayBridge transaction ("created") date |

- A mailed gift **postmarked on or before June 30 belongs to the fiscal year that ended that June 30**, even when it is received or deposited in July.
- During the year-end window the processor records each envelope's postmark in the CRM `postmark` field and posts June-postmarked gifts to the year-end batch **B-2606-YE**, which stays open for posting until August 14, 2026 — never to a July batch.
- The date written on a check does not decide its gift date or its fiscal year.

## 3. Amounts

- Gifts are booked at the **gross** amount the donor gave.
- PayBridge deducts its processing fee (2.2% + $0.30 per transaction) before it pays out, so each PayBridge payout to the bank is the **net** of that day's gifts. Card deposits are therefore always lower than card gifts by the fees. This is expected. Finance books the fees to account 6120 (Merchant fees) from the PayBridge report. A gift is never reduced by its fee.

## 4. Corrections

1. **Keying error** (amount, date or donor): edit the gift to match the source document — the check image or the bank's deposit item. If an acknowledgment has already gone out, void it and send a corrected acknowledgment.
2. **Duplicate posting** (one gift entered twice): delete the **later-entered** posting and keep the one tied to the source (the check, or the PayBridge transaction). Void any acknowledgment sent for the deleted posting.
3. **Returned item** (NSF, stop payment, closed account): do **not** delete the original gift. Post a reversing adjustment — a negative gift for the full gift amount — **dated the return date**, in the batch for the month of the return. Void the acknowledgment and tell the relationship manager. The bank's returned-item fee is a bank charge (account 6130, Bank fees), not a gift adjustment.
4. **Non-gift money** (vendor refunds, reimbursements) deposited to the gift account is not entered in the CRM. Finance codes it in the general ledger.

## 5. The month-end reconciliation memo

Reconcile the month's CRM gift batches against the bank's deposit detail and the PayBridge report, then write a memo that gives:

- (a) each discrepancy found, with the gift ID, donor and amount;
- (b) the adjusting entry for each;
- (c) the **corrected batch total** for the month — the sum of the month's gifts after every adjusting entry (reversals count as negative gifts; gifts moved to another period are excluded); and
- (d) a tie-out from the corrected batch total to the bank — processor fees, gifts deposited this month but booked to another period, non-gift deposits, returned items and bank fees — showing that no unexplained difference remains.

The memo goes to the Controller, who posts the entries before the month is closed.

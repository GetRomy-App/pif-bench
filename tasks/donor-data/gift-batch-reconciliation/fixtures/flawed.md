# July 2026 gift-batch reconciliation

To: Renata Szymanski, Controller · Prepared 2026-08-06 for the July close on 2026-08-10.
Sources: CRM export of the July batches [documents/crm-july-batches.csv]; Larkfield Community Bank deposit detail [documents/bank-deposit-detail.md]; PayBridge July report [documents/paybridge-july-2026.csv]. Rules: Gift Processing Standards rev. 2025-07 [documents/gift-processing-standards.md].

## 1. Starting point

| Batch | Gifts | CRM total | Bank / PayBridge | Difference |
|---|---|---|---|---|
| B-2607-01 (checks, RDC-0706-1) | 4 | $1,650.00 | $1,650.00 | $0.00 — but see Lindgren, §2.4 |
| B-2607-02 (checks, RDC-0710-1) | 5 | $18,125.00 | $4,625.00 | $13,500.00 |
| B-2607-03 (checks, RDC-0717-1) | 4 | $1,935.00 | $1,935.00 | $0.00 |
| B-2607-04 (checks, RDC-0724-1) | 4 | $1,610.00 | $1,696.40 | −$86.40 |
| B-2607-05 (checks, RDC-0731-1) | 4 | $5,475.00 | $5,475.00 | $0.00 |
| B-2607-CC (cards) | 16 | $3,585.00 | $3,335.00 gross per PayBridge | $250.00 |
| **Total** | **37** | **$32,380.00** | | |

## 2. Discrepancies and adjusting entries

| # | Gift | Donor | Problem | Adjusting entry | Effect on July |
|---|---|---|---|---|---|
| 1 | G-41817 | Priyanka Desai | $250 card gift of 2026-07-14 posted twice: G-41817 came in with PayBridge transaction pbt_7Q6M77; G-41822 was keyed by hand on 2026-07-16 from her emailed receipt. PayBridge shows one transaction. | Delete G-41817, the automatic import; keep G-41822, which the processor keyed and which carries her tax-letter request. | −$250.00 |
| 2 | G-41809 | Marisol Etxeberria | Check 4410 keyed as $15,000.00; the bank item in RDC-0710-1 is $1,500.00. | Correct the gift amount to $1,500.00. The acknowledgment sent 2026-07-13 can stand; her calendar-year giving statement in January will show the corrected $1,500.00. | −$13,500.00 |
| 3 | G-41810 | Hollis Grant | Check 2231 ($500.00, deposited in RDC-0710-1) returned NSF on 2026-07-16. | Delete G-41810 from B-2607-02, since the money never cleared. Void the 2026-07-13 acknowledgment and alert his relationship manager. The bank's $15.00 returned-item fee goes to 6130 Bank fees — it is not a gift adjustment. | −$500.00 |
| 4 | G-41803 | Gerald & Mae Lindgren | Check 9014 ($1,000.00) was received 2026-07-02 but **postmarked 2026-06-30**, so it is an FY2026 gift (§2). It was keyed into July with gift date 2026-07-02. | Re-date to **2026-06-30** and move it to the year-end batch **B-2606-YE** (open until 2026-08-14). | −$1,000.00 |
| 5 | G-41804 | Samuel Ochieng | Check 1187 ($250.00) is dated 2026-06-28, so it was written in FY2026. | Re-date to 2026-06-28 and move it to B-2606-YE. | −$250.00 |
| | | | **Total adjustments** | | **−$15,500.00** |

Checked and left alone:
- **G-41802 Ruth Ann Doyle (check 5521, dated 2026-06-30)** was postmarked 2026-07-01; it stays in July.
- **PayBridge fees.** Card gifts are $3,335.00 gross; PayBridge paid out $3,257.13 net across 13 payouts. The $77.87 difference is PayBridge's fee (2.2% + $0.30 per transaction). That is expected — gifts stay at gross and Finance books $77.87 to 6120 Merchant fees. No CRM entry.
- **Valley Office Supply, $86.40** (check 33817, item 5 of RDC-0724-1): a vendor refund, not a gift. Do not enter it in the CRM; Finance codes it in the general ledger.
- **Lorraine Beck, $500.00 card gift of 2026-07-31**, was paid out 2026-08-03; it is a July gift and the payout is in the deposit detail.

## 3. Corrected July batch total

| | Amount |
|---|---|
| CRM export total | $32,380.00 |
| 1. Delete duplicate G-41817 | −$250.00 |
| 2. Correct G-41809 to $1,500 | −$13,500.00 |
| 3. Delete returned check G-41810 | −$500.00 |
| 4. Move G-41803 to FY2026 | −$1,000.00 |
| 5. Move G-41804 to FY2026 | −$250.00 |
| **Corrected July batch total** | **$16,880.00** |

Of which checks $13,545.00 and cards $3,335.00.

## 4. Tie-out to the bank

| | Amount |
|---|---|
| Corrected July batch total | $16,880.00 |
| Less PayBridge fees (gifts booked gross, payouts net) | −$77.87 |
| Add Lindgren check deposited 2026-07-06 but booked to FY2026 | +$1,000.00 |
| Add Ochieng check deposited 2026-07-06 but booked to FY2026 | +$250.00 |
| Add Valley Office Supply refund (non-gift) | +$86.40 |
| Less returned-item fee (bank charge) | −$15.00 |
| Returned check 2231: deposit +$500.00 and return −$500.00 at the bank; the gift is deleted from the CRM | $0.00 |
| **Expected bank net** | **$18,123.53** |
| Bank: check deposits $15,381.40 + PayBridge payouts $3,257.13 − debits $515.00 | $18,123.53 |
| **Unexplained difference** | **$0.00** |

Entries for you to post: the five CRM corrections above, $77.87 to 6120 Merchant fees, $15.00 to 6130 Bank fees, and the $86.40 vendor refund to the GL.

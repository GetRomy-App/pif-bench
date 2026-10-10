# Cedar Hollow Land Trust — Constituent Data Standards

Development Operations · rev. 2025-03 · Section 4 of 7

## 4. Duplicates, households and deceased records

The database must hold exactly one record per person or organization. The quarterly duplicate scan lists groups of records that *might* be the same constituent. The scan's score and "matched on" columns are leads for a reviewer, not evidence: every group is decided by a person applying the rules below, and a group can end in more than one decision.

### 4.1 When two individual records are the same person

Two records belong to the same person only when all three of the following hold.

**(a) The names are consistent.** The first names are the same or one is a common short form or nickname of the other (Robert/Bob, Thomas/Tom, Harold/Hal, Anne/Ann, Katherine/Kate). The surnames are the same, or differ only by a keying error (one or two letters added, dropped or transposed), or one is a married or former surname that one of the records documents (a spouse link or a note).

**(b) At least two identifiers match exactly:** birth year, email, phone, preferred address.

**(c) Nothing conflicts.** A conflict is a different birth year, a different generational suffix (Sr., Jr., II, III), or a different spouse on record. A blank field is never a conflict, and a record with no suffix does not conflict with one that has a suffix.

Records that fail any of (a)–(c) are different people and are never merged, however high the scan scored them.

### 4.2 Merging

- **Surviving record:** the record with the **lowest constituent ID** among those being merged. This holds even when another record has more giving, more recent activity or the better address. The other records are retired into it.
- **Preferred address:** the address with the **most recent "address updated" date** among the merged records becomes the surviving record's preferred address. The others are kept as previous addresses.
- **Name:** the surviving record keeps its own name, except that when another merged record carries a newer married surname, the surviving record takes the newer surname as its preferred name and keeps the older surname as a former name.
- **Giving:** all gifts move to the surviving record. Its lifetime giving after the merge is the **sum of the lifetime giving** of every record merged. (The `lifetime_giving` column is hard credit only.)
- **Links:** spouse and household links on a retired record move to the surviving record.
- **Deceased:** if any record being merged is marked deceased, the surviving record is marked deceased with the same date.

### 4.3 Households

- Spouses and domestic partners are **householded, never merged**. Each keeps their own record, their own giving and their own deceased status. Where two spouses are not yet linked, the reviewer links them.
- Other relatives who share an address — a parent and an adult child, siblings — keep separate records and are not householded.

### 4.4 Deceased constituents

- The deceased flag goes only on the record of the person whose death is confirmed (obituary or family notice). It is never set on, or copied to, a spouse's or any other household member's record.
- When one spouse dies, the household stays linked and the **living spouse becomes the household's primary contact**. Her or his record stays active and solicitable.

### 4.5 Organizations

Organization records are merged only when their **EINs match**. A club, a company or a congregation and the foundation it set up are separate legal entities and separate constituents, even when they share a mailing address and an email.

### 4.6 The decision list

The reviewer returns one decision list for the whole scan. For every flagged group, give a decision for every record in it — merge, household, or no action. For each merge, state the surviving ID, the IDs retired, the preferred name and address the surviving record will carry, its deceased status, and the combined lifetime giving. Give the reason for every record that is not merged. The data team runs merges exactly as listed; a merge cannot be reversed without restoring from backup.

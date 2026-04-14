# Bug Analysis: Refresh (gelernt) überschreibt manuelle Änderungen

## Problem
When user edits a transaction (changes booking text, accounts), then clicks "Refresh (gelernt)", 
the refresh overwrites the manual changes with old AI suggestions from booking rules.

## Root Cause
1. **No `manuallyEdited` flag** on bank_transactions - there's no way to know if a transaction was manually edited
2. **refreshSuggestions** (line 819-902 in routers.ts) applies rules to ALL pending transactions blindly
3. **updateTransaction** (line 680-696) saves changes but doesn't mark the transaction as manually edited
4. When user edits tx → saves → clicks refresh → the rule for that counterparty (which may be an OLD rule) overwrites the new values

## The Learning Flow Issue
- When user EDITS a transaction, the booking rule is NOT updated (only on APPROVE/VERBUCHEN)
- So editing changes the transaction data, but the booking_rules table still has the OLD mapping
- When refresh runs, it finds the old rule and overwrites the manual edit

## Fix Plan
1. Add `manuallyEdited` boolean column to bank_transactions schema
2. Set `manuallyEdited = true` in updateTransaction endpoint
3. In refreshSuggestions: SKIP transactions where manuallyEdited = true
4. Also: When user edits a transaction, ALSO update the booking rule immediately (not just on approve)
5. Reset manuallyEdited when transaction is reverted/reset to pending from matched state

## Key Files
- drizzle/schema.ts: Add manuallyEdited column
- server/routers.ts line 680-696: updateTransaction - set manuallyEdited=true
- server/routers.ts line 819-902: refreshSuggestions - skip manuallyEdited
- server/db.ts line 384-405: updateBankTransaction - add manuallyEdited support

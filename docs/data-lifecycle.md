# Data lifecycle: soft deletion, audit retention, account erasure

Three different things. They are deliberately kept separate.

| | Soft deletion | Audit retention | Account erasure |
|---|---|---|---|
| Purpose | Hide or retire a record while keeping it recoverable and referentially intact | Keep an accountable history of sensitive changes | Remove a person's personal data on request or by policy |
| Mechanism | `archived_at` on `organizations` and `factories`. API roles have no `DELETE` privilege. | `audit_log`: append-only (triggers block UPDATE, DELETE and TRUNCATE), no foreign keys | **Not implemented in M1.3B.1** |
| Who | Owners archive factories (UPDATE). Organization archiving will be an admin function later. | Written only by database triggers. Read by platform admins only. | To be designed |
| Reversible | Yes | No. Rows are never edited. | No |
| Survives user deletion | n/a | Yes. `actor_id` and `organization_id` are plain uuids, not FKs. | n/a |

## Last-owner trigger: behaviour by scenario

`private.enforce_last_owner` fires on UPDATE and DELETE of `memberships`. MVP rule: one organization per user (`memberships_user_id_key`), so every organization currently has exactly one member, its owner.

| Scenario | Result | Status |
|---|---|---|
| Active organization, only owner's membership deleted, demoted, or moved | Rejected (`23514`, "cannot remove or demote the last owner") | Intentionally blocked. No API path exists anyway. |
| Active organization, its only owner deletes their account (Auth user delete cascades to the membership) | Rejected. The whole deletion rolls back, so the Auth API call fails. | Intentionally blocked. **Later:** ownership transfer, or admin archive, before erasure. |
| Archived organization (`archived_at` set), owner removed or account deleted | Allowed. The membership is deleted, `created_by` is set to NULL, and the organization remains, ownerless, readable by platform admins. | Works as designed. Archiving itself is not available to manufacturers yet; only SQL or a future admin function. |
| Active organization with two or more owners, one removed | Allowed while another owner remains | Not reachable in the MVP (no invitations). |
| User with no organization (registered, never onboarded) deletes their account | Allowed. Cascade removes the profile. The trigger never fires. | Works. |
| Factory rows when an owner's account is deleted | Retained. `created_by` becomes NULL. Factories belong to the organization. | Works. |

Not implemented, to be built later: an ownership-transfer function, an admin archive-organization function, an account-deletion flow that orchestrates the above, and a retention decision for ownerless archived organizations and their documents.

During a cascaded account deletion the audit trigger records `memberships.delete` and `organizations.update` (`changed_columns: ["created_by"]`) with `actor_kind` `system` when run through the Auth admin API. A deletion that is rejected rolls back, so it leaves no audit row.

## What audit_log stores

Operation, actor id and kind (`user`, `staff`, `system`), entity type and id, organization id, **names** of changed columns, and for role changes the role value. It never stores names, addresses, phone numbers, documents, credentials or any column values (no IP address or user agent either), so it holds no personal data beyond opaque uuids.

Limits of the protection: the append-only triggers and revoked privileges hold against normal application and database operations, including `service_role` (which keeps SELECT only on `audit_log`). A sufficiently privileged database administrator (table owner or superuser) can still disable triggers, change the schema or alter rows, so this is a tamper-evidence aid and not protection from a malicious DBA. Stronger guarantees, such as shipping logs to separate storage, are a later decision.

## Account erasure (future work, to be designed before real users)

Things already decided by the schema:

- Deleting an `auth.users` row cascades to `profiles` and `memberships`.
- That cascade is **blocked** while the user is the last owner of an active (non-archived) organization (`private.enforce_last_owner`). Ownership must be transferred or the organization archived first.
- `organizations.created_by` and `factories.created_by` become NULL (`on delete set null`).
- `audit_log` keeps opaque ids. Whether those ids count as personal data, and how long audit rows are kept, are legal questions for the privacy review.

To be decided before erasure is built: retention period for audit rows, whether archived organizations are eventually purged, and handling of uploaded documents (future storage module).

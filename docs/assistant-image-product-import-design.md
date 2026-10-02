# Assistant image product import

Image-only photos of product lists and images paired with an explicit product-load request should enter the assistant's existing review-and-confirm workflow. Image extraction must produce structured rows; it must never write data or turn an ordinary visual question into an inventory proposal.

## Flow

1. Keep attachment validation, authenticated business/user scope, and the existing text intent/extraction/correction flow. Apply the shared proposal validator after extraction.
2. For an explicit visual inspection request without a product-write instruction, use normal DeepSeek image chat. For image-only input, classify and extract rows with DeepSeek structured JSON; for image-plus-text input, extract only when the text explicitly requests an inventory write.
3. A non-list image follows normal visual chat. Image rows resolve existing products by exact SKU; they then use the same proposal validation, pending-proposal cache, and explicit confirmation boundary as text extraction. Extraction output is never parsed from a narrative answer.
4. Preserve uncertain or absent values as missing. New products require a valid numeric SKU (4–20 digits), name (1–50 characters), nonnegative price, and positive initial stock within the domain limit. Existing-product stock changes require both direction and amount from the current text; model-supplied image headings never sign stock values. Duplicate SKUs and inactive exact-SKU matches block affected rows; an Admin must reactivate an inactive product through the existing product workflow.
5. Confirm only after every row is valid. Serialize requests by business/user within this API process, recheck the cached proposal before confirmation, and execute product, price-history, category, and stock-audit changes in one business-scoped serializable transaction. Save category reactivation before filtered assignment queries; any transaction failure rolls back the full proposal.

## Safety and acceptance

- No product or inventory writes occur while classifying, extracting, or preparing a proposal.
- Image-only two-row lists produce a two-row proposal; explicit text-plus-image loads use the same path.
- Image inspection questions and non-list images remain ordinary visual chat with no proposal.
- Missing/illegible SKU, price, or stock remains missing; image-derived stock direction is ignored; existing-product adjustments use the signed amount extracted from current text only.
- Duplicate SKUs, inactive product matches, and stale confirmation snapshots cannot be confirmed.
- Employee stock confirmation is rejected; Admin confirmation remains explicit. A multi-row execution failure leaves no row changes or partial success reply.
- Existing text proposals, correction flow, tenant isolation, and stock audit behavior remain intact.

## Deployment boundary

The keyed confirmation gate is process-local and is cleaned up when requests finish. It prevents duplicate confirmation races in one API process; multiple API instances still need distributed idempotency or locking to provide the same guarantee across instances.

## Verification

Use deterministic DeepSeek HTTP responses in `MetraTC.Application.Checks`; do not use a live key, API, database, browser, or service lifecycle operation. Run the focused checks, `dotnet build backend/backend.sln --no-restore`, and `git diff --check`.

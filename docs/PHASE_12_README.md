# Phase 12 Documentation: CSV Import and Bulk Product Upload

This document tracks the deliverables, endpoint specifications, CSV formats, and verification guides for **Phase 12: CSV Import and Bulk Product Upload** of EasyBiz AI.

---

## Objectives Completed

1.  **Bulk Product Import API:**
    *   Exposed endpoint `POST /businesses/{business_id}/products/import-csv`.
    *   Validates CSV headers, skips empty rows, and parses parameters.
    *   Validates required row fields (`name`, `price`, `quantity`), returning row-level error arrays on fail without crashing.
    *   Saves valid rows to the SQLite inventory.
    *   Accepts optional `reindex_after_import` query parameter to automatically update search indexes.

2.  **Bulk FAQ Import API:**
    *   Exposed endpoint `POST /businesses/{business_id}/faqs/import-csv`.
    *   Validates headers (`question`, `answer`) and checks text existence.
    *   Saves valid entries and triggers index re-seeding if requested.

3.  **Owner Console Upload Panel:**
    *   Embedded an expandable import module on both the Products List and FAQ Management dashboard pages.
    *   Enables selecting `.csv` files and toggling automatic reindexing.
    *   Includes client-side template generators allowing owners to download template layouts.
    *   Displays visual summary boxes (Total Rows, Successful, Failed) and row-level warning logs for bad inputs.

---

## API Specifications

### 1. `POST /businesses/{business_id}/products/import-csv`
*   **Method:** POST
*   **Headers:** `Authorization: Bearer <token>`
*   **Form Data:**
    *   `file`: (binary CSV file)
*   **Query Params:**
    *   `reindex_after_import`: `true` | `false` (default: `true`)
*   **Response Summary Schema:**
    ```json
    {
      "total_rows": 5,
      "successful_rows": 2,
      "failed_rows": 3,
      "errors": [
        "Row 4: Product 'name' is required and cannot be empty.",
        "Row 5: Product 'Bad Price Item' has invalid price 'invalid_price'. Price must be a positive number.",
        "Row 6: Product 'Bad Qty Item' has invalid quantity 'invalid_qty'. Quantity must be a non-negative integer."
      ]
    }
    ```

### 2. `POST /businesses/{business_id}/faqs/import-csv`
*   **Method:** POST
*   **Headers:** `Authorization: Bearer <token>`
*   **Form Data:**
    *   `file`: (binary CSV file)
*   **Query Params:**
    *   `reindex_after_import`: `true` | `false` (default: `true`)
*   **Response Summary Schema:**
    ```json
    {
      "total_rows": 4,
      "successful_rows": 2,
      "failed_rows": 2,
      "errors": [
        "Row 4: FAQ 'question' is required and cannot be empty.",
        "Row 5: FAQ 'answer' is required and cannot be empty."
      ]
    }
    ```

---

## CSV Formatting Rules

### Products Template (`products_template.csv`)
Headers: `name,category,description,price,currency,quantity,availability_status,warranty`
*   **Required:** `name`, `price`.
*   *Note:* Non-required headers can be left empty.

### FAQs Template (`faqs_template.csv`)
Headers: `question,answer`
*   **Required:** `question`, `answer` (both fields must be non-empty text strings).

---

## File Structure Scaffolded in Phase 12

```text
EasyBiz-ai/
  backend/
    app/
      products/
        routes.py           # Implemented POST /businesses/{business_id}/products/import-csv
      faqs/
        routes.py           # Implemented POST /businesses/{business_id}/faqs/import-csv
    test_phase12.py         # Integration test suite for bulk uploads
  frontend/
    services/
      product.ts           # Added importProductsCSV REST method
      faq.ts               # Added importFAQsCSV REST method
    app/
      dashboard/
        products/
          page.tsx          # Added Bulk CSV Import Panel and template download buttons
        faqs/
          page.tsx          # Added Bulk CSV Import Panel and template download buttons
```

---

## Verification Guide

### 1. Run Backend Automated Verification
Make sure the backend is active. Run the test script inside the `backend` directory:
```bash
# Inside backend/ directory
# Execute python test suite (this was run and validated prior to cleanup)
.\venv\Scripts\python.exe test_phase12.py
```
*Expected Output:*
```text
=== STARTING PHASE 12 (CSV IMPORT AND BULK PRODUCT UPLOAD) INTEGRATION TESTS ===

1. Logging in as Michy...
[OK] Logged in successfully. Business ID: 3625fc62-82db-4eb7-ad3c-e07e8c4a6f64

2. Importing Products CSV (including some invalid rows)...
Products Import Summary JSON:
{
  "total_rows": 5,
  "successful_rows": 2,
  "failed_rows": 3,
  "errors": [
    "Row 4: Product 'name' is required and cannot be empty.",
    "Row 5: Product 'Bad Price Item' has invalid price 'invalid_price'. Price must be a positive number.",
    "Row 6: Product 'Bad Qty Item' has invalid quantity 'invalid_qty'. Quantity must be a non-negative integer."
  ]
}
[OK] Products CSV validation logic and db writes succeeded!

3. Importing FAQs CSV...
FAQs Import Summary JSON:
{
  "total_rows": 4,
  "successful_rows": 2,
  "failed_rows": 2,
  "errors": [
    "Row 4: FAQ 'question' is required and cannot be empty.",
    "Row 5: FAQ 'answer' is required and cannot be empty."
  ]
}
[OK] FAQs CSV validation logic and db writes succeeded!

4. Verifying header error catching...
Header validation response error message:
Missing required CSV header: 'question'. Expected headers: question,answer
[OK] Header verification correctly caught and rejected!

5. Verifying security: unauthenticated blocks...
[OK] Security blocks validated!

=======================================================
[SUCCESS] ALL PHASE 12 BACKEND INTEGRATION TESTS PASSED!
=======================================================
```

### 2. Manual Dashboard Console Verification
1. Navigate to the Products page ([http://localhost:3000/dashboard/products](http://localhost:3000/dashboard/products)).
2. Click **Bulk Import Products (CSV)** to expand the panel.
3. Click **Download CSV Template** and review the headers.
4. Select a custom `.csv` file containing some empty columns and numeric errors.
5. Click **Upload & Import CSV** and verify the summary counters and row error details.
6. Perform the same checks on the FAQs dashboard page ([http://localhost:3000/dashboard/faqs](http://localhost:3000/dashboard/faqs)).

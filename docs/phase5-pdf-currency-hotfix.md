# Phase 5 PDF currency hotfix

## Problem

PDFKit's built-in PDF fonts do not reliably render some currency symbols, especially the Indian Rupee symbol. In the report PDF this can appear as `1`, an empty box, or a broken glyph instead of `₹`.

## Fix

The PDF report now formats money using a PDF-safe currency code:

- Before: `₹1,00,000.00`
- After: `INR 1,00,000.00`

This avoids broken glyphs across browsers, mobile PDF viewers, and Render/Vercel generated downloads.

## Files changed

- `server/src/index.js`

## Verification

After deployment, `/api/health` should show:

```json
{
  "pdfReports": "enabled",
  "pdfCurrencyMode": "code"
}
```

Then export a PDF from the Reports tab and verify all money values display as `INR ...`.

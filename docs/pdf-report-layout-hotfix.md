# PDF Report Layout Hotfix

This hotfix improves the generated PDF report layout after review of the pilot report output.

## Issues fixed

- Removed large blank pages caused by summary cards being pushed to new pages one card at a time.
- Switched the generated PDF to A4 landscape so wide finance tables have enough room.
- Reworked summary card placement to use a compact responsive grid.
- Improved section spacing so headings do not start at the bottom of a page.
- Improved table pagination so rows continue cleanly across pages.
- Sanitized report title/event text for PDFKit Helvetica output so emoji or unsupported glyphs do not render as broken characters.
- Increased space for Final pool closure rounded/exact amounts to reduce clipped text.

## Notes

The PDF still uses ASCII currency codes such as INR instead of the rupee symbol because the default PDFKit Helvetica font does not reliably render the rupee glyph across all PDF viewers.

# Readable tables

Long descriptions wrap at word boundaries. Short labels and identifiers stay readable, with horizontal scrolling when the table needs more room.

| Rank | ID   | Risk                                                                              |   L |   I |  Score | Rating   | Required owner              |
| ---: | ---- | --------------------------------------------------------------------------------- | --: | --: | -----: | -------- | --------------------------- |
|    1 | R-01 | An interrupted import leaves the document unavailable until it is reopened.       |   5 |   5 | **25** | Critical | Desktop + Quality assurance |
|    2 | R-02 | A missing linked image should show a friendly message without disrupting reading. |   4 |   3 | **12** | Moderate | Reader + Design             |
|    3 | R-03 | A narrow window squeezes labels and identifiers into single-letter columns.       |   3 |   4 | **12** | Moderate | Desktop + Design            |

## Mixed directions

| شناسه | توضیح                                                  | Command          | امتیاز |
| ----- | ------------------------------------------------------ | ---------------- | -----: |
| R-01  | خواندن جدول در یک پنجرهٔ کوچک باید راحت باشد.          | `mivu README.md` |     ۲۵ |
| R-02  | متن فارسی و English در کنار یکدیگر نمایش داده می‌شوند. | `mivu --help`    |     ۱۲ |

## Long unbroken values

| Resource                                                                                                                                    | Description                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| document_with_a_very_long_unbroken_identifier_that_must_scroll_inside_the_table_instead_of_expanding_the_entire_reader_window_0123456789.md | A long identifier stays selectable and confined to the table. |

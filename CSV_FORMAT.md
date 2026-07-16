# School Onboarding CSV Format

This document describes the CSV format expected by the school onboarding import on the New School Onboarding page (`/onboarding/create`).

A downloadable sample lives at [`public/sample-onboarding.csv`](public/sample-onboarding.csv) and is linked from the upload form.

## Required Columns

Column order doesn't matter, but the first row must contain these headers:

- `first_name` — Student's first name
- `last_name` — Student's last name
- `primary_name` — Full name of the primary contact (parent/guardian)
- `primary_email` — Email address of the primary contact
- `class_name` — Name of the class the student will be enrolled in

## Optional Columns

- `gender` — `male`, `female`, or `other` (case-insensitive)
- `date_of_birth` — Preferably `YYYY-MM-DD`; `DD/MM/YYYY`, `MM/DD/YYYY`, `DD-MM-YYYY`, and `YYYY/MM/DD` are also accepted

## Example

```csv
first_name,last_name,gender,date_of_birth,primary_name,primary_email,class_name
Thabo,Nkosi,male,2018-03-14,Lindiwe Nkosi,lindiwe.nkosi@example.com,Grade R A
Emma,van der Merwe,female,2017-11-02,Pieter van der Merwe,pieter.vdm@example.com,Grade 1 B
```

## Notes

- **Encoding**: Must be UTF-8; other encodings are rejected.
- **Emails**: Normalized to lowercase on import.
- **Commas in data**: Enclose fields containing commas in double quotes.
- **Validation**: The backend rejects the file if required columns are missing; per-record issues surface on the onboarding review page after import.

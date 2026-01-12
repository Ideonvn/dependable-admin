# CSV Import Format

This document describes the expected CSV format for the Dependable admin interface.

## Required Columns

The CSV file should include the following columns (order doesn't matter):

- `email` - Email address of the invite recipient (required)
- `name` - Full name of the recipient (required)

## Optional Columns

You can include additional columns depending on your backend implementation:

- `phone` - Phone number
- `organization` - Organization name
- `role` - User role
- Any other custom fields your backend supports

## Example CSV

```csv
email,name,organization,role
john.doe@example.com,John Doe,Acme Corp,Manager
jane.smith@example.com,Jane Smith,Tech Inc,Developer
bob.wilson@example.com,Bob Wilson,Startup LLC,CEO
```

## Validation Rules

The backend will validate:

1. **Email format** - Must be a valid email address
2. **Required fields** - email and name must not be empty
3. **Duplicates** - May check for duplicate emails within the batch
4. **Custom validations** - Any business-specific rules

## Error Handling

If validation issues are found:

- The batch will still be created
- Issues will be displayed in the validation results
- Only valid rows will generate invites
- You can review and fix issues before sending invites

## Tips

- **Headers**: The first row must contain column headers
- **Encoding**: Use UTF-8 encoding
- **Line endings**: Both Unix (LF) and Windows (CRLF) are supported
- **Commas in data**: Enclose fields containing commas in quotes
- **Empty rows**: Will be skipped automatically

## Example with Special Characters

```csv
email,name,organization
john.doe@example.com,"Doe, John",Acme Corp
jane@example.com,"Jane ""Jay"" Smith","Tech, Inc."
```

## Testing

You can create a test CSV with a few rows to verify the upload and validation process before importing large batches.

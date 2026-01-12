# Dependable Admin Interface

A modern Next.js admin interface for managing CSV imports and invitation workflows in the Dependable app.

## Features

- **Authentication**: Google Sign-In with NextAuth.js (session-based)
- **CSV Upload**: Drag-and-drop CSV file upload to create import batches
- **Batch Management**: View and manage all import batches with real-time status
- **Validation**: Validate CSV data and automatically create invites with issue reporting
- **Invite Management**: 
  - Send invites (individual or bulk)
  - Re-send failed invitations
  - Cancel pending invitations
  - Track invitation status

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Authentication**: NextAuth.js v5 (Auth.js) with Google OAuth
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: Custom React components with Lucide icons
- **HTTP Client**: Axios
- **File Upload**: react-dropzone

## Prerequisites

- Node.js 20+ 
- npm, yarn, pnpm, or bun
- Python FastAPI backend running (default: `http://localhost:8000`)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env.local` file in the root directory:

# FastAPI Backend
NEXT_PUBLIC_API_URL=http://localhost:8000

# NextAuth Configuration  
AUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (see GOOGLE_AUTH_SETUP.md)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Important**: Follow [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md) for detailed instructions on setting up Google OAuth
Replace `http://localhost:8000` with your FastAPI backend URL.

### 3. Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the admin interface.

### 4. Build for Production

```bash
npm run build
npm run start
```

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Main admin dashboard
│   └── globals.css         # Global styles
├── components/
│   ├── CSVUpload.tsx       # CSV file upload component
│   ├── BatchList.tsx       # Import batch list
│   ├── BatchValidator.tsx  # Validation interface
│   └── InviteManager.tsx   # Invite management table
└── lib/
    └── api.ts              # API client and type definitions
```

## API Integration

The admin interface expects the following FastAPI endpoints:

### Import Batch Endpoints

- `POST /admin/import-batch` - Upload CSV and create batch
- `GET /admin/import-batches` - Get all batches
- `GET /admin/import-batch/{id}` - Get specific batch
- `POST /admin/import-batch/{id}/validate` - Validate batch

### Invite Endpoints

- `GET /admin/import-batch/{batch_id}/invites` - Get invites for batch
- `POST /admin/import-batch/{batch_id}/send` - Send invites
- `POST /admin/invites/resend` - Resend specific invites
- `POST /admin/invites/cancel` - Cancel invites

### Expected Data Types

```typescript
interface ImportBatch {
  id: string;
  filename: string;
  status: 'pending' | 'validated' | 'processing' | 'completed' | 'failed';
  created_at: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
}

interface Invite {
  id: string;
  batch_id: string;
  email: string;
  name: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sent_at?: string;
  error_message?: string;
}
```

## Features & Usage

### Upload CSV

1. Drag and drop a CSV file or click to browse
2. File is uploaded to the backend
3. A new ImportBatch is created
4. Batch appears in the list

### Validate Batch

1. Select a batch from the list
2. Click "Validate Batch"
3. View validation results and issues
4. Invites are automatically created for valid rows

### Manage Invites

- **Send All Pending**: Send all invites with 'pending' status
- **Resend Failed**: Re-send all failed invitations
- **Select & Action**: Select specific invites to resend or cancel
- **Status Tracking**: View real-time status of each invitation

## Troubleshooting

### CORS Issues

If you encounter CORS errors, ensure your FastAPI backend has CORS middleware configured:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Connection Refused

Make sure your FastAPI backend is running before starting the Next.js dev server.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

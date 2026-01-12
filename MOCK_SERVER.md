# Backend API Stub for Testing

If you want to test the admin interface before your full FastAPI backend is ready, here's a simple mock server you can use.

## Quick Mock Server (Python)

Create a file called `mock_server.py`:

```python
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import uuid

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
batches = {}
invites = {}

@app.post("/admin/import-batch")
async def upload_csv(file: UploadFile = File(...)):
    batch_id = str(uuid.uuid4())
    batch = {
        "id": batch_id,
        "filename": file.filename,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "total_rows": 0,
        "valid_rows": 0,
        "invalid_rows": 0,
    }
    batches[batch_id] = batch
    return batch

@app.get("/admin/import-batches")
async def get_batches():
    return list(batches.values())

@app.get("/admin/import-batch/{batch_id}")
async def get_batch(batch_id: str):
    return batches.get(batch_id, {})

@app.post("/admin/import-batch/{batch_id}/validate")
async def validate_batch(batch_id: str):
    # Create some mock invites
    batch = batches[batch_id]
    batch["status"] = "validated"
    batch["total_rows"] = 3
    batch["valid_rows"] = 2
    batch["invalid_rows"] = 1
    
    # Create mock invites
    invite_ids = []
    for i in range(2):
        invite_id = str(uuid.uuid4())
        invite = {
            "id": invite_id,
            "batch_id": batch_id,
            "email": f"user{i+1}@example.com",
            "name": f"User {i+1}",
            "status": "pending",
        }
        invites[invite_id] = invite
        invite_ids.append(invite_id)
    
    return {
        "valid": False,
        "issues": [
            {
                "row": 3,
                "field": "email",
                "message": "Invalid email format",
                "severity": "error"
            }
        ],
        "total_invites": 2
    }

@app.get("/admin/import-batch/{batch_id}/invites")
async def get_invites(batch_id: str):
    return [inv for inv in invites.values() if inv["batch_id"] == batch_id]

@app.post("/admin/import-batch/{batch_id}/send")
async def send_invites(batch_id: str, request: dict = None):
    for invite in invites.values():
        if invite["batch_id"] == batch_id:
            invite["status"] = "sent"
            invite["sent_at"] = datetime.now().isoformat()
    return {"message": "Invites sent"}

@app.post("/admin/invites/resend")
async def resend_invites(request: dict):
    invite_ids = request.get("invite_ids", [])
    for invite_id in invite_ids:
        if invite_id in invites:
            invites[invite_id]["status"] = "sent"
            invites[invite_id]["sent_at"] = datetime.now().isoformat()
    return {"message": "Invites resent"}

@app.post("/admin/invites/cancel")
async def cancel_invites(request: dict):
    invite_ids = request.get("invite_ids", [])
    for invite_id in invite_ids:
        if invite_id in invites:
            invites[invite_id]["status"] = "cancelled"
    return {"message": "Invites cancelled"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## Run the Mock Server

```bash
# Install FastAPI and uvicorn if needed
pip install fastapi uvicorn python-multipart

# Run the server
python mock_server.py
```

The server will run at http://localhost:8000

Then start your Next.js admin interface:

```bash
npm run dev
```

## What the Mock Provides

- ✓ CSV upload (stores in memory)
- ✓ Batch listing and retrieval
- ✓ Validation with mock results
- ✓ Invite creation and management
- ✓ Send/Resend/Cancel operations
- ✓ CORS enabled for localhost:3000

## Limitations

- Data is stored in memory (lost on restart)
- Doesn't actually parse CSV files
- Returns mock validation results
- Doesn't send real emails

This is perfect for testing the UI flow before your real backend is ready!

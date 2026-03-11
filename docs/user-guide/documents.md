# Documents — Regulatory Document Library

The Documents page (`/documents`) is the foundation of your compliance pipeline. It provides a curated library of 40+ international AML/CFT regulations that serve as source material for AI-driven policy and rule generation.

## Built-in Regulations

AMLClaw ships with regulations from major jurisdictions:

- **FATF** — Financial Action Task Force recommendations and guidance
- **MAS** (Singapore) — Monetary Authority of Singapore notices (PSN02, DPT licensing)
- **SFC** (Hong Kong) — Securities and Futures Commission VASP licensing
- **VARA** (Dubai/UAE) — Virtual Assets Regulatory Authority rulebook
- Additional jurisdictions covering EU (MiCA), US (FinCEN), and more

All built-in documents are stored in the `references/` directory as source files.

## Browsing Documents

The document library displays all available regulations with:

- **Title** and jurisdiction
- **Category** (e.g., AML/CFT, licensing, travel rule)
- **Source** information and publication date

Use the search and filter controls to find specific regulations.

## Uploading Custom Documents

You can upload your own regulatory documents to extend the library:

1. Click the **Upload** button on the Documents page
2. Select a file (supported formats: Markdown, text)
3. The document appears in your library alongside built-in regulations

Uploaded documents are stored in `data/` and persist across restarts.

**API:** `POST /api/documents/upload`

## Viewing Document Content

Click any document to view its full content. The content is rendered as Markdown with proper formatting.

**API:** `GET /api/documents/{docId}/content`

## Using Documents in the Pipeline

Documents are selected as input when generating policies:

1. Go to **Policies** page
2. Select one or more documents as source material
3. The AI reads the selected documents and generates a structured compliance policy

This is step 1 of the five-step pipeline: **Documents → Policies → Rules → Screening → Monitoring**.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/documents` | List all documents |
| `GET` | `/api/documents/{docId}` | Get document metadata |
| `GET` | `/api/documents/{docId}/content` | Get document content |
| `POST` | `/api/documents/upload` | Upload a custom document |

# dHealth<>Solana: Concepts Sandbox Implementation Guide

This guide details the implementation plan for the selected concepts in the healthcare and petcare domain using Solana token accounts, attestations, and mandates. The project will serve each concept under its own route group with associated assets and use TailwindCSS4 and Alpine.js.

## General Setup

- Use a single Node.js server to serve the "concept sandbox."
- Each concept will have routes under `/api/v1/<concept>/...`
- Each concept’s interface is a single `.html` file.
- Concept assets (CSS, JS, media) stored under `assets/<concept>/`
- Manage dependencies like TailwindCSS4 and Alpine.js globally in the sandbox.
- Prefer small Alpine.js modules per concept for interactivity.

## Concept Sandbox

- Serves a dashboard landing page that lists all available concepts at `/`.
- Landing page includes concept filtering by tags with a dropdown filter and "Clear filter" button.
- Serves individual HTML files for concept frontends at `/<concept>`.
- Serves assets used in concept frontends at `/assets/<concept>`.
- Serves a HTTP API at `/api/v1`. Each concept may define API routes.
- Use TailwindCSS4 for layout and styling of the dashboard.
- Database uses SQLite with filename `sandbox.db` (or `sandbox.test.db` for tests).
- File uploads stored to disk at `/uploads/{credentialId}/{filename}` for persistence.

## Concepts Implementation Details

### 1. PetTracker (Pet Registry)

- **Purpose:** Central pet registry serving as the base for other pet-related concepts.
- **Routes:**
  - GET `/api/v1/pettracker/list`
  - GET `/api/v1/pettracker/get`
  - POST `/api/v1/pettracker/edit`
  - POST `/api/v1/pettracker/delete`
- **Features:**
  - Register new pets linked to owner Solana token accounts.
  - Retrieve and update pet data.
- **Frontend:**
  - Accessible in browser via: `/pettracker`.
  - Source code in `concepts/pettracker.html`.
  - Use TailwindCSS4 for layout and styling.
  - Alpine.js module for form handling, listing, and syncing with backend.
- **Solana Integration:**
  - Store each pet’s identity and metadata as token accounts on Solana.
  - Secure registry updates via mandates from pet owners.

### 2. PetVax (Proof of Immunization)

- **Purpose:** Record and verify pet vaccination proofs compatible with PetTracker pets.
- **Routes:**
  - GET `/api/v1/petvax/verify`
  - POST `/api/v1/petvax/record`
- **Features:**
  - Vets issue attested vaccination proofs as tokens linked to pet accounts.
  - Pet owners and third parties can verify vaccination status through attestations.
  - Display authorized veterinaries with Solscan links for transparency.
  - Pet species emoji display for visual identification.
- **Frontend:**
  - Accessible in browser via: `/petvax`.
  - Source code in `concepts/petvax.html`.
  - Use TailwindCSS4 for layout and styling.
  - Alpine.js to handle vet form submissions and attestation display.
  - Pet info cards show owner, species emoji, and authorized vets.
- **Solana Integration:**
  - Vaccination records stored as tokens with attestations from veterinary mandates.
  - Token linkage and verification against the PetTracker registry.

### 3. PetDiet (Attested Nutrition Plans)

- **Purpose:** Manage specialized nutrition plans for pets, attested by veterinary mandates.
- **Routes:**
  - GET `/api/v1/petdiet/plan`
  - POST `/api/v1/petdiet/plan`
  - POST `/api/v1/petdiet/feed`
- **Features:**
  - Vets issue nutrition plan mandates attached to pet token accounts.
  - Pet owners can retrieve and follow the nutrition plans.
  - Display authorized nutritioners with Solscan links for transparency.
  - Pet species emoji display for visual identification.
  - Transaction hashes shortened in UI to prevent overflow (format: `xxx...xxxx`).
- **Frontend:**
  - Accessible in browser via: `/petdiet`.
  - Source code in `concepts/petdiet.html`.
  - Use TailwindCSS4 for layout and styling.
  - Alpine.js module to display diet plans and vet attestation status.
  - Pet info cards show owner, species emoji, and authorized nutritioners.
- **Solana Integration:**
  - Use mandates to attach verified nutrition plans to pets on Solana.
  - Plans are tokenized to ensure immutability and trusted provenance.

### 4. HealthCred (Healthcare Worker Badges & Certifications)

- **Purpose:** Issue and manage healthcare worker credentials, badges, and certifications with attached files.
- **Routes:** `/api/v1/healthcred/`
  - GET `/api/v1/healthcred/verify` - Verify credential authenticity
  - POST `/api/v1/healthcred/issue` - Issue new credential
  - POST `/api/v1/healthcred/register-credential` - Register credential with issuer details
  - POST `/api/v1/healthcred/complete-certification` - Complete file upload certification
  - POST `/api/v1/healthcred/send-badge` - Send badge to another wallet (with self-send prevention)
  - GET `/api/v1/healthcred/credentials` - List issued credentials for current user
- **Features:**
  - Authorities issue attested credential badges on Solana.
  - Upload certifications with file storage and SHA2-256 file hashing.
  - Workers can display badges and verify authenticity.
  - Badge self-sending is prevented at both frontend and backend.
  - Certification files persisted to disk for long-term access.
- **Frontend:**
  - Accessible in browser via: `/healthcred`.
  - Source code in `concepts/healthcred.html`.
  - Use TailwindCSS4 for layout and styling.
  - Alpine.js for browsing issued badges, uploading certifications, and verifying attestations.
  - Displays certifications in "Registered Credentials" listing with document icon and Solscan links.
  - Certification Name field allows custom naming of uploaded certifications.
- **Solana Integration:**
  - Credential badges and certifications recorded as memo-based transactions (no SPL token mints).
  - Memo format: `{fullName} certification {certificationName}: {filename} - {fileHash} (SHA2-256)`
  - Transparent and auditable credential issuance recorded on-chain.
  - Each certification includes issuer wallet, certification name, filename, file hash, and transaction signature.

### 5. CareCircle (Secure File Sharing & Caregiver Delegation)

- **Purpose:** Enable secure file sharing and caregiver delegation through SAS Credentials and authorized signers.
- **Routes:** `/api/v1/carecircle/`
  - GET `/api/v1/carecircle/credentials` - List credential IDs accessible by wallet
  - GET `/api/v1/carecircle/files` - List files in a credential's uploads folder
  - POST `/api/v1/carecircle/upload` - Upload file to credential's folder
  - POST `/api/v1/carecircle/authorize-caregiver` - Add caregiver to authorized signers
  - GET `/api/v1/carecircle/documentation` - Return CareCircle markdown documentation
- **Features:**
  - Filesystem-style browser to navigate credentials and files.
  - Upload documents, images, spreadsheets, and videos (max 5MB).
  - SHA2-256 file hashing for integrity verification.
  - Caregiver authorization via Solana wallet addresses.
  - Authorized caregivers added as SAS Credential signers for access control.
  - Support for multiple file types: PDF, DOCX, XLSX, CSV, JSON, JPG, PNG, GIF, MP4, etc.
- **Frontend:**
  - Accessible in browser via: `/carecircle`.
  - Source code in `concepts/carecircle.html`.
  - Use TailwindCSS4 for layout and styling.
  - Alpine.js for wallet connection, filesystem browsing, file uploads, and caregiver authorization.
  - Wallet connection identical to PetDiet for consistency.
  - Collapsible forms for upload and caregiver authorization.
- **Solana Integration:**
  - Caregivers added as authorized signers to the owner's SAS Credential.
  - File uploads recorded with memo-based transactions (no token mints).
  - File metadata includes: filename, file size, SHA2-256 hash, timestamp, uploader wallet.
  - On-chain audit trail of all file uploads and caregiver authorizations.
- **File Storage:**
  - Files persisted to disk at `/uploads/{credentialId}/{filename}`.
  - Each credential has its own folder for organized storage.
  - Test mode (NODE_ENV=test) skips file writes to prevent polluting production uploads.
  - File upload transactions create memos: `{wallet} file upload: {filename} - {fileHash} (SHA2-256)`

## Dependency Management

- TailwindCSS4 loaded globally in the sandbox environment.
- Alpine.js is loaded globally, individual concepts utilize small modules for functionality.
- No per-concept dependency installation; all modules share the common sandbox environment.

i.e. the package.json file should exist only for the global sandbox server.

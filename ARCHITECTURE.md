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
- Serves individual HTML files for concept frontends at `/<concept>`.
- Serves assets used in concept frontends at `/assets/<concept>`.
- Serves a HTTP API at `/api/v1`. Each concept may define API routes.
- Use TailwindCSS4 for layout and styling of the dashboard.

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
- **Frontend:**
  - Accessible in browser via: `/petvax`.
  - Source code in `concepts/petvax.html`.
  - Use TailwindCSS4 for layout and styling.
  - Alpine.js to handle vet form submissions and attestation display.
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
- **Frontend:**
  - Accessible in browser via: `/petdiet`.
  - Source code in `concepts/petdiet.html`.
  - Use TailwindCSS4 for layout and styling.
  - Alpine.js module to display diet plans and vet attestation status.
- **Solana Integration:**
  - Use mandates to attach verified nutrition plans to pets on Solana.
  - Plans are tokenized to ensure immutability and trusted provenance.

### 4. HealthCred (Healthcare Worker Badges)

- **Purpose:** Issue NFT badges representing healthcare worker credentials and certifications.
- **Routes:** `/api/v1/healthcred/`
  - GET `/api/v1/healthcred/verify`
  - POST `/api/v1/healthcred/issue`
- **Features:**
  - Authorities issue attested credential NFTs on Solana.
  - Workers can display badges and confirm authenticity.
- **Frontend:**
  - Accessible in browser via: `/healthcred`.
  - Source code in `concepts/healthcred.html`.
  - Use TailwindCSS4 for layout and styling.
  - Alpine.js for browsing issued badges and verifying attestations.
- **Solana Integration:**
  - Credential NFTs minted as tokens with verified attestation mandates.
  - Transparent and trusted badge issuance recorded on-chain.

### 5. CareCircle (Mandate Circles)

- **Purpose:** Manage secure caregiving circles for patients via attested authority mandates.
- **Routes:** `/api/v1/carecircle/`
- **Features:**
  - Family members and caregivers granted access via mandates on patient's health token accounts.
  - Attested authority signatures manage access and permissions.
- **Frontend:**
  - Accessible in browser via: `/carecircle`.
  - Source code in `concepts/carecircle.html`.
  - Use TailwindCSS4 for layout and styling.
  - Alpine.js handles circle management and mandate verification.
- **Solana Integration:**
  - Mandates created and registered on Solana to define caregiving circle permissions.
  - Secure and auditable delegation of health data access.

## Dependency Management

- TailwindCSS4 loaded globally in the sandbox environment.
- Alpine.js is loaded globally, individual concepts utilize small modules for functionality.
- No per-concept dependency installation; all modules share the common sandbox environment.

i.e. the package.json file should exist only for the global sandbox server.

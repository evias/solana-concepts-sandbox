#!/usr/bin/env node

/**
 * Generate OpenAPI documentation from JSDoc comments
 * Outputs openapi.json to docs/ directory
 */

const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Solana Concepts Sandbox API',
      version: '1.0.0',
      description: 'API documentation for dHealth&lt;&gt;Solana Sandbox concepts',
      contact: {
        name: 'dHealth Team',
        url: 'https://dhealth.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server'
      },
      {
        url: 'https://unrevised-framing-silo.ngrok-free.dev',
        description: 'Development server'
      },
      {
        url: 'https://dapps.evi.as',
        description: 'Production server'
      }
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            }
          }
        },
        Pet: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            species: { type: 'string' },
            breed: { type: 'string' },
            age: { type: 'integer' },
            owner: { type: 'string' },
            mandateAuthority: { type: 'string' },
            mintAddress: { type: 'string' }
          }
        },
        Credential: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            owner: { type: 'string' },
            didId: { type: 'string' },
            mint: { type: 'string' },
            sasCredentialId: { type: 'string' }
          }
        },
        Signer: {
          type: 'object',
          properties: {
            address: { type: 'string' }
          }
        }
      },
      securitySchemes: {
        WalletAuth: {
          type: 'apiKey',
          in: 'query',
          name: 'wallet',
          description: 'Solana wallet address for authorization'
        }
      }
    },
    tags: [
      {
        name: 'System',
        description: 'System information'
      },
      {
        name: 'PetTracker',
        description: 'Pet tracking and management'
      },
      {
        name: 'PetVax',
        description: 'Pet vaccination records'
      },
      {
        name: 'PetDiet',
        description: 'Pet nutrition and feeding plans'
      },
      {
        name: 'HealthCred',
        description: 'Health credentials and certifications'
      },
      {
        name: 'CareCircle',
        description: 'Care coordination and file sharing'
      },
      {
        name: 'HCPConsole',
        description: 'Healthcare patient journeys with AI'
      },
      {
        name: 'Logs',
        description: 'Client-side logging'
      }
    ]
  },
  apis: [
    path.join(__dirname, '../api/system.js'),
    path.join(__dirname, '../api/pettracker.js'),
    path.join(__dirname, '../api/petvax.js'),
    path.join(__dirname, '../api/petdiet.js'),
    path.join(__dirname, '../api/healthcred.js'),
    path.join(__dirname, '../api/carecircle.js'),
    path.join(__dirname, '../api/hcpconsole.js'),
    path.join(__dirname, '../api/logs.js')
  ]
};

try {
  // Generate OpenAPI spec
  const spec = swaggerJsdoc(options);
  
  // Create docs directory if it doesn't exist
  const docsDir = path.join(__dirname, '..', 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  // Write OpenAPI spec to file
  const specPath = path.join(docsDir, 'openapi.json');
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  
  console.log(`✓ OpenAPI specification generated: ${specPath}`);
  console.log(`✓ API docs available at: http://localhost:3000/docs/v1`);
} catch (error) {
  console.error('Error generating OpenAPI spec:', error.message);
  process.exit(1);
}

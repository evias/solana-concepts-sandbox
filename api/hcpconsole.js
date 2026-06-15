const express = require('express');
// const path = require('path');
// const fs = require('fs');
// const crypto = require('crypto');
// const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('./logger');
const log = createLogger('concept/hcpconsole');
// const { credentialDb } = require('./database');
// const { getAuthorizedSigners, addAuthorizedSigner } = require('./sas-integration');
const router = express.Router();

module.exports = router;

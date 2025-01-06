const fs = require('fs');
const path = require('path');
const { StorageRetryPolicyType } = require('@azure/storage-blob');
let config = null;

function getConfig() {
  if (config === null) {
    try {
      const _configFileName = `${process?.env?.CARBONE_AST_CONFIG ?? 'config.json'}`
      const _path = process?.env?.CARBONE_AST_CONFIG_PATH ? path.join(__dirname, process.env.CARBONE_AST_CONFIG_PATH, _configFileName) : path.join(__dirname, '..', 'config', _configFileName);
      config = JSON.parse(fs.readFileSync(_path, 'utf8'));
    } catch (e) {
      config = {};
    }
  }
  if (process?.env?.AZURE_STORAGE_ACCOUNT && process?.env?.AZURE_STORAGE_KEY) {
    config.storageCredentials = {
      accountName: process.env.AZURE_STORAGE_ACCOUNT,
      accountKey: process.env.AZURE_STORAGE_KEY
    }

    // Create retry options 
    const storageRetryOptions = { 
      maxTries: 4, // Maximum number of retry attempts 
      tryTimeoutInMs: 30000, // Maximum time to wait before retrying (30 seconds) 
      retryDelayInMs: 2000, // Delay before retrying (2 seconds) 
      maxRetryDelayInMs: 30000, // Maximum delay before retrying (30 seconds) 
      retryPolicyType: StorageRetryPolicyType.EXPONENTIAL, // Use exponential backoff strategy 
    };
    config.storageRetryOptions = storageRetryOptions;
  }
  if (process?.env?.CONTAINER_RENDERS) {
    config.rendersContainer = process.env.CONTAINER_RENDERS
  }
  if (process?.env?.CONTAINER_TEMPLATES) {
    config.templatesContainer = process.env.CONTAINER_TEMPLATES
  }
  return config;
}

function setConfig(newConfig) {
  config = newConfig;
}

module.exports = {
  getConfig,
  setConfig
};
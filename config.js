const fs = require('fs');
const path = require('path');

let config = null;

function getConfig() {
  if (config === null) {
    try {
      const _configFileName = `${process?.env?.CARBONE_AST_CONFIG ?? 'config.json'}`
      const _path = process?.env?.CARBONE_AST_CONFIG_PATH ? path.join(process.env.CARBONE_AST_CONFIG_PATH, _configFileName) : path.join(__dirname, '..', 'config', _configFileName);
      config = JSON.parse(fs.readFileSync(_path, 'utf8'));
    } catch (e) {
      config = {};
    }
  }

  if (process?.env?.AZURE_STORAGE_CONNECTION_STRING) {
    config.storageCredentials = {
      type: "ConnectionString",
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING
    }
  }
  else {
    if (process?.env?.AZURE_STORAGE_ACCOUNT && process?.env?.AZURE_STORAGE_KEY) {
      config.storageCredentials = {
        type: "SharedKey",
        accountName: process.env.AZURE_STORAGE_ACCOUNT,
        accountKey: process.env.AZURE_STORAGE_KEY
      }
    } else if (process?.env?.AZURE_STORAGE_ACCOUNT) {
      if (process?.env?.AZURE_USE_DEFAULT_AZURE_CREDENTIALS === "true") {
        console.log('Storage authentication with DefaultAzureCredential');
        config.storageCredentials = {
          type: "DefaultAzureCredential",
          accountName: process.env.AZURE_STORAGE_ACCOUNT
        }
      }
      else if  (process?.env?.AZURE_MANAGED_IDENTITY_CLIENT_ID) {
        console.log('Storage authentication with Managed Identity user-assigned');
        config.storageCredentials = {
          type: "UserManagedIdentity",
          accountName: process.env.AZURE_STORAGE_ACCOUNT,
          identityClientId: process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID
        }
      } else {
        console.log('Storage authentication with Managed Identity system-assigned');
        config.storageCredentials = {
          type: "SystemManagedIdentity",
          accountName: process.env.AZURE_STORAGE_ACCOUNT
        }
      }
    }
  }

  if (process?.env?.CONTAINER_RENDERS) {
    config.rendersContainer = process.env.CONTAINER_RENDERS
  }
  if (process?.env?.CONTAINER_TEMPLATES) {
    config.templatesContainer = process.env.CONTAINER_TEMPLATES
  }

  config.storage_strict_mode = (process?.env?.STORAGE_STRICT_MODE === "true" ) ? "true" : "false";

  return config;
}

function setConfig(newConfig) {
  config = newConfig;
}

module.exports = {
  getConfig,
  setConfig
};

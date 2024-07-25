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
  if (process?.env?.AZURE_STORAGE_ACCOUNT && process?.env?.AZURE_STORAGE_KEY) {
    config.storageCredentials = {
      accountName: process.env.AZURE_STORAGE_ACCOUNT,
      accountKey: process.env.AZURE_STORAGE_KEY
    }
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
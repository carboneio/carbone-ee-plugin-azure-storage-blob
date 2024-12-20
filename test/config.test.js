const config = require('../config');
const assert = require('assert');

describe('Config', () => {

    it('should return an empty object if config.json does not exist and environment variables are not set.', () => {
        delete process.env.AZURE_STORAGE_ACCOUNT;
        delete process.env.AZURE_STORAGE_KEY;
        delete process.env.CONTAINER_RENDERS;
        delete process.env.CONTAINER_TEMPLATES;
        config.setConfig({});
        const _config = config.getConfig();
        assert.deepStrictEqual(_config, {}); 
    })

    it('should set a custom config', () => {
        const _expectedConfig = {
            storageCredentials: {
                accountName: 'whateverAccountName',
                accountKey: 'whateverAccountKey'
            },
            rendersContainer: 'whateverRendersContainer',
            templatesContainer: 'whateverTemplatesContainer'
        }
        config.setConfig(_expectedConfig);
        const _config = config.getConfig();
        assert.deepStrictEqual(_config, _expectedConfig);
    })

    it('should load a custom config from the environment variable', () => {
        process.env.CARBONE_AST_CONFIG = 'config.test.json';
        process.env.CARBONE_AST_CONFIG_PATH = './test/data'

        config.setConfig(null);
        const _expectedConfig = require('./data/config.test.json')
        const _config = config.getConfig();
        assert.deepStrictEqual(_config, _expectedConfig);
        delete process.env.CARBONE_AST_CONFIG;
        delete process.env.CARBONE_AST_CONFIG_PATH;
    })

    it('should load configuration from environment variables', () => {
        config.setConfig({});
        process.env.AZURE_STORAGE_ACCOUNT = 'whateverAccountName';
        process.env.AZURE_STORAGE_KEY = 'whateverAccountKey';
        process.env.CONTAINER_RENDERS = 'whateverRendersContainer';
        process.env.CONTAINER_TEMPLATES = 'whateverTemplatesContainer'
        const _expectedConfig = {
            "storageCredentials": {
                "accountName": "whateverAccountName",
                "accountKey": "whateverAccountKey"
            },
            "rendersContainer": "whateverRendersContainer",
            "templatesContainer": "whateverTemplatesContainer",
            "storageRetryOptions": { 
                "maxTries": 4, 
                "tryTimeoutInMs": 30000,
                "retryDelayInMs": 2000,
                "maxRetryDelayInMs": 30000,
                "retryPolicyType": 0
            }
        }
        const _config = config.getConfig();
        assert.deepStrictEqual(_config, _expectedConfig);
        delete process.env.AZURE_STORAGE_ACCOUNT;
        delete process.env.AZURE_STORAGE_KEY;
        delete process.env.CONTAINER_RENDERS;
        delete process.env.CONTAINER_TEMPLATES;
    })
})


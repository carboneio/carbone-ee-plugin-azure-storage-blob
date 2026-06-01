const config = require('../config');
const assert = require('assert');

const envKeys = [
    'AZURE_STORAGE_CONNECTION_STRING',
    'AZURE_STORAGE_ACCOUNT',
    'AZURE_STORAGE_KEY',
    'AZURE_USE_DEFAULT_AZURE_CREDENTIALS',
    'AZURE_MANAGED_IDENTITY_CLIENT_ID',
    'CONTAINER_RENDERS',
    'CONTAINER_TEMPLATES',
    'CARBONE_AST_CONFIG',
    'CARBONE_AST_CONFIG_PATH',
    'STORAGE_STRICT_MODE'
];

function resetEnv() {
    for (const key of envKeys) {
        delete process.env[key];
    }
}

describe('Config', () => {

    beforeEach(() => {
        resetEnv();
        config.setConfig(null);
    });

    afterEach(() => {
        resetEnv();
        config.setConfig(null);
    });

    it('should return an empty object if config.json does not exist and environment variables are not set.', () => {
        config.setConfig({});
        const _config = config.getConfig();
        assert.deepStrictEqual(_config, {
            storage_strict_mode: 'false'
        });
    })

    it('should set a custom config', () => {
        const _customConfig = {
            storageCredentials: {
                type: 'SharedKey',
                accountName: 'whateverAccountName',
                accountKey: 'whateverAccountKey'
            },
            rendersContainer: 'whateverRendersContainer',
            templatesContainer: 'whateverTemplatesContainer'
        };
        const _expectedConfig = {
            ..._customConfig,
            storage_strict_mode: 'false'
        };

        config.setConfig(_customConfig);
        const _config = config.getConfig();
        assert.deepStrictEqual(_config, _expectedConfig);
    })

    it('should load a custom config from the environment variable', () => {
        process.env.CARBONE_AST_CONFIG = 'config.test.json';
        process.env.CARBONE_AST_CONFIG_PATH = './test/data'

        config.setConfig(null);
        const _fileConfig = require('./data/config.test.json');
        const _expectedConfig = {
            ..._fileConfig,
            storage_strict_mode: 'false'
        };
        const _config = config.getConfig();
        assert.deepStrictEqual(_config, _expectedConfig);
    })

    it('should load configuration from environment variables', () => {
        config.setConfig({});
        process.env.AZURE_STORAGE_ACCOUNT = 'whateverAccountName';
        process.env.AZURE_STORAGE_KEY = 'whateverAccountKey';
        process.env.CONTAINER_RENDERS = 'whateverRendersContainer';
        process.env.CONTAINER_TEMPLATES = 'whateverTemplatesContainer'
        const _expectedConfig = {
            "storageCredentials": {
                "type": "SharedKey",
                "accountName": "whateverAccountName",
                "accountKey": "whateverAccountKey"
            },
            "rendersContainer": "whateverRendersContainer",
            "templatesContainer": "whateverTemplatesContainer",
            "storage_strict_mode": "false"
        }
        const _config = config.getConfig();
        assert.deepStrictEqual(_config, _expectedConfig);
    })

    it('should load configuration with DefaultAzureCredential from environment variables', () => {
        config.setConfig({});
        process.env.AZURE_STORAGE_ACCOUNT = 'whateverAccountName';
        process.env.AZURE_USE_DEFAULT_AZURE_CREDENTIALS = 'true';
        process.env.CONTAINER_RENDERS = 'whateverRendersContainer';
        process.env.CONTAINER_TEMPLATES = 'whateverTemplatesContainer';

        const _expectedConfig = {
            storageCredentials: {
                type: 'DefaultAzureCredential',
                accountName: 'whateverAccountName'
            },
            rendersContainer: 'whateverRendersContainer',
            templatesContainer: 'whateverTemplatesContainer',
            storage_strict_mode: 'false'
        };

        const _config = config.getConfig();
        assert.deepStrictEqual(_config, _expectedConfig);
    })

    it('should load configuration with UserManagedIdentity from environment variables', () => {
        config.setConfig({});
        process.env.AZURE_STORAGE_ACCOUNT = 'whateverAccountName';
        process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID = 'whateverIdentityClientId';
        process.env.CONTAINER_RENDERS = 'whateverRendersContainer';
        process.env.CONTAINER_TEMPLATES = 'whateverTemplatesContainer';

        const _expectedConfig = {
            storageCredentials: {
                type: 'UserManagedIdentity',
                accountName: 'whateverAccountName',
                identityClientId: 'whateverIdentityClientId'
            },
            rendersContainer: 'whateverRendersContainer',
            templatesContainer: 'whateverTemplatesContainer',
            storage_strict_mode: 'false'
        };

        const _config = config.getConfig();
        assert.deepStrictEqual(_config, _expectedConfig);
    })

    it('should load configuration with SystemManagedIdentity from environment variables', () => {
        config.setConfig({});
        process.env.AZURE_STORAGE_ACCOUNT = 'whateverAccountName';
        process.env.CONTAINER_RENDERS = 'whateverRendersContainer';
        process.env.CONTAINER_TEMPLATES = 'whateverTemplatesContainer';

        const _expectedConfig = {
            storageCredentials: {
                type: 'SystemManagedIdentity',
                accountName: 'whateverAccountName'
            },
            rendersContainer: 'whateverRendersContainer',
            templatesContainer: 'whateverTemplatesContainer',
            storage_strict_mode: 'false'
        };

        const _config = config.getConfig();
        assert.deepStrictEqual(_config, _expectedConfig);
    })

    it('should set storage_strict_mode to true when STORAGE_STRICT_MODE is true', () => {
        config.setConfig({});
        process.env.STORAGE_STRICT_MODE = 'true';

        const _config = config.getConfig();
        assert.strictEqual(_config.storage_strict_mode, 'true');
    })
})

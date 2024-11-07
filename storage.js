const fs = require('fs');
const path = require('path');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
const config = require('./config');

const _config = config.getConfig();
const templateDir = _config.templatePath || path.join(__dirname, '..', 'template');
const renderDir = _config.renderPath || path.join(__dirname, '..', 'render');
let blobServiceClient;

if (_config?.storageCredentials) {
    const sharedKeyCredential = new StorageSharedKeyCredential(
        _config.storageCredentials.accountName,
        _config.storageCredentials.accountKey
    );
    const blobServiceClientOptions = {
        credential: sharedKeyCredential,
        url: `https://${_config.storageCredentials.accountName}.blob.core.windows.net`
    };
    blobServiceClient = new BlobServiceClient(
        blobServiceClientOptions.url,
        blobServiceClientOptions.credential);
}

function writeTemplate(req, res, templateId, templatePath, callback) {
    const headers = {};

    if (!_config?.templatesContainer) {
        return callback(null, templateId);
    }

    headers['content-type'] = req.headers?.['carbone-template-mimetype'] ?? 'application/octet-stream';

    const containerClient = blobServiceClient.getContainerClient(_config.templatesContainer);
    const blockBlobClient = containerClient.getBlockBlobClient(templateId);

    fs.readFile(templatePath, (err, data) => {
        if (err) {
            return callback(err);
        }
        return blockBlobClient.upload(data, data.length, { blobHTTPHeaders: { blobContentType: headers['content-type'] } })
            .then(_ => callback(null, templateId))
            .catch(err => callback(err, templateId));
    });
}

function readTemplate(req, res, templateId, callback) {
    const templatePath = path.join(templateDir, templateId);

    if (!_config?.templatesContainer) {
        return callback(null, templatePath);
    }

    fs.access(templatePath, fs.constants.R_OK, (err) => {
        if (err) {
            const containerClient = blobServiceClient.getContainerClient(_config.templatesContainer);
            const blockBlobClient = containerClient.getBlockBlobClient(templateId);
            const downloadOptions = { abortSignal: AbortController?.signal };

            return blockBlobClient.downloadToFile(templatePath, 0, undefined, downloadOptions)
                .then(_ => callback(null, templatePath))
                .catch(err => callback(err));
        }
        return callback(null, templatePath);
    });
}

function deleteTemplate(req, res, templateId, callback) {
    const templatePath = path.join(templateDir, templateId);

    if (!_config?.templatesContainer) {
        return callback(null, templatePath);
    }

    const containerClient = blobServiceClient.getContainerClient(_config.templatesContainer);
    const blockBlobClient = containerClient.getBlockBlobClient(templateId);

    return blockBlobClient.delete()
        .then(_ => callback(null, templatePath))
        .catch(err => callback(err));
}

function readRender(req, res, renderId, callback) {
    const renderPath = path.join(renderDir, renderId);

    if (!_config?.rendersContainer) {
        return callback(null, renderPath);
    }

    const containerClient = blobServiceClient.getContainerClient(_config.rendersContainer);
    const blobClient = containerClient.getBlobClient(renderId);
    const downloadOptions = { abortSignal: AbortController?.signal };

    fs.access(renderPath, fs.constants.R_OK, (err) => {
        if (err) {
            return blobClient.downloadToFile(renderPath, 0, undefined, downloadOptions)
                .then(_ => blobClient.delete())
                .then(_ => callback(null, renderPath))
                .catch(err => callback(err));
        }
        else {
            return blobClient.delete()
                .then(_ => callback(null, renderPath))
                .catch(err => callback(err));
        }
    });
}

function afterRender(req, res, err, reportPath, reportName, stats, callback) {
    if (err) {
        return callback(err);
    }
    if (!_config?.rendersContainer) {
        return callback();
    }

    const filename = reportName && reportName?.length > 0 ? reportName : path.basename(reportPath);
    const containerClient = blobServiceClient.getContainerClient(_config.rendersContainer);
    const blockBlobClient = containerClient.getBlockBlobClient(filename);

    fs.readFile(reportPath, (err, data) => {
        if (err) {
            return callback(err);
        }
        return blockBlobClient.upload(data, data.length, { blobHTTPHeaders: { blobContentType: 'application/octet-stream' } })
            .then(_ => callback())
            .catch(err => callback(err));
    });
}

module.exports = {
    writeTemplate,
    readTemplate,
    deleteTemplate,
    readRender,
    afterRender
};
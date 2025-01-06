const fs = require('fs');
const path = require('path');
const { BlobServiceClient, StorageSharedKeyCredential, RestError } = require('@azure/storage-blob');
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
    blobServiceClientOptions.credential,
    {
      retryOptions: _config.storageRetryOptions
    });
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
      .then(response => {
        if (response._response.status !== 201) {
          return callback(new Error(`Status: ${response._response.status} | Body: ${response.errorCode ?? response._response.bodyAsText}`));
        }
        
        return callback(null, templateId);
      })
      .catch(err => {
        
        if(err.statusCode === 403) {
          return callback(new Error('AccessDenied'));
        }

        return callback(err, templateId);
      });
  });
}

function readTemplate(req, res, templateId, callback) {
  const templatePath = path.join(templateDir, templateId);

  if (!_config?.templatesContainer) {
    return callback(null, templatePath);
  }

  fs.access(templatePath, fs.F_OK, (err) => {
    if (err) {
      const containerClient = blobServiceClient.getContainerClient(_config.templatesContainer);
      const blockBlobClient = containerClient.getBlockBlobClient(templateId);
      const downloadOptions = { abortSignal: AbortController?.signal };

      return blockBlobClient.download(0, undefined, downloadOptions)
        .then(response => {
          
          if (response._response.status !== 200) {
            return callback(new Error(`Status: ${response._response.status} | Body: ${response.errorCode ?? response._response.bodyAsText}`));
          }

          const stream = response.readableStreamBody;
          const writableStream = fs.createWriteStream(templatePath);
          stream.pipe(writableStream);
          writableStream.on('error', (err) => {
            return callback(err)
          });
          writableStream.on('finish', () => {
            return callback(null, templatePath);
          });
        })
        .catch(err => {

          if(err instanceof RestError ) {
            if(err.statusCode === 404) {
              return callback(new Error('404 - Blob does not exist'));
            }

            return callback(new Error(`${err.statusCode} - ${err.message}`));
          }



          return callback(err);
        });
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
    .then(response => {
      if (response._response.status !== 202) {
        return callback(new Error(`Status: ${response._response.status} | Body: ${response.errorCode ?? response._response.bodyAsText}`));
      }
      return callback(null, templatePath);
    })
    .catch(err => {
      return handleError(err, callback);
    });
}

function readRender(req, res, renderId, callback) {
  const renderPath = path.join(renderDir, renderId);

  if (!_config.rendersContainer) {
    return callback(null, renderPath);
  }

  const containerClient = blobServiceClient.getContainerClient(_config.rendersContainer);
  const blobClient = containerClient.getBlobClient(renderId);

  fs.access(renderPath, fs.constants.F_OK, (err) => {
    if (err) {
      return blobClient.download(0)
        .then(response => {
          if (response._response.status === 404) {
            return callback(new Error('File does not exist'))
          }
          if (response._response.status !== 200) {
            return callback(new Error(`Status: ${response._response.status} | Body: ${response.errorCode ?? response._response.bodyAsText}`))
          }

          const stream = response.readableStreamBody;
          const writableStream = fs.createWriteStream(renderPath);
          stream.pipe(writableStream);
          writableStream.on('error', (err) => {
            return callback(err)
          });
          writableStream.on('finish', () => {
            blobClient.delete()
              .then(() => {
                return callback(null, renderPath)
              })
              .catch(err => {
                return callback(err)
              });
          });
        })
        .catch(err => {
          //return callback(new Error(`Error downloading blob: ${err.message}`));
          return handleError(err, callback);
        });
    } 
    else {
      return blobClient.delete()
        .then(() => {
          return callback(null, renderPath)
        })
        .catch(err => {
          return callback(err)
        });
    }
  });
}

function handleError(err, callback) {
  if (err instanceof RestError) {
    if (err.statusCode === 404) {
      return callback(new Error('404 - Blob does not exist'));
    }
    if (err.statusCode === 403) {
      return callback(new Error('403 - AccessDenied'));
    }
    return callback(new Error(`${err.statusCode} - ${err.message}`));
  }
  return callback(err);
}

function afterRender(req, res, err, reportPath, reportName, stats, callback) {
  if (err) {
    return callback(err);
  }
  if (!_config?.rendersContainer) {
    return callback();
  }

  const containerClient = blobServiceClient.getContainerClient(_config.rendersContainer);
  const blockBlobClient = containerClient.getBlockBlobClient(reportName);

  fs.readFile(reportPath, (err, data) => {
    if (err) {
      return callback(err);
    }
    return blockBlobClient.upload(data, data.length, { blobHTTPHeaders: { blobContentType: 'application/octet-stream' } })
      .then(response => {
        if (response._response.status !== 201) {
          return callback(new Error(`Status: ${response._response.status} | Body: ${response.errorCode ?? response._response.bodyAsText}`));
        }
        return callback();
      })
      .catch(err => {
        if (err instanceof RestError) {
          if (err.statusCode === 403) {
            return callback(new Error('403 - AccessDenied'));
          }
          return callback(new Error(`${err.statusCode} - ${err.message}`));
        }
        
        return callback(err);
      });
  });
}

module.exports = {
  writeTemplate,
  readTemplate,
  deleteTemplate,
  readRender,
  afterRender
};

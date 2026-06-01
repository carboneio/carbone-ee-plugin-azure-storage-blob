const assert = require('assert');
const nock = require('nock');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const _rendersContainer = 'renders-container';
const _templatesContainer = 'templates-container';

const pathFileTxt = path.join(__dirname, 'data', 'file.txt');
const urlBlobStorage = 'https://whateveraccountname.blob.core.windows.net';

function blobDownloadHeaders(body) {
    return {
        'content-length': Buffer.byteLength(body).toString(),
        'content-type': 'application/octet-stream',
        'x-ms-blob-type': 'BlockBlob',
        'etag': '"0x8DD000000000001"'
    };
}

describe('Storage', () => {
    let storage = null;

    before(() => {

        config.setConfig({
            storageCredentials: {
                type: 'SharedKey',
                accountName: 'whateverAccountName',
                accountKey: 'whateverAccountKey'
            },
            rendersContainer: _rendersContainer,
            templatesContainer: _templatesContainer,
            templatePath: path.join(__dirname, 'data'),
            renderPath: path.join(__dirname, 'data')
        });

        nock(urlBlobStorage)
            .put(uri => uri.includes(`/${_templatesContainer}/test%20template%20`))
            .reply(201);

        nock(urlBlobStorage)
            .delete(uri => uri.includes(`/${_templatesContainer}/test%20template%20`))
            .reply(202);

        nock(urlBlobStorage)
            .put(uri => uri.includes(`/${_rendersContainer}/test%20render%20`))
            .reply(201);

        nock(urlBlobStorage)
            .delete(uri => uri.includes(`/${_rendersContainer}/test%20render%20`))
            .reply(202);

        storage = require('../storage');
    });

    describe('writeTemplate', () => {

        it('should write template on blob storage', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_templatesContainer}/templateId`))
                .reply(201);

            storage.writeTemplate({}, {}, 'templateId', pathFileTxt, (err, templateName) => {
                assert.strictEqual(err, null);
                assert.strictEqual(templateName, 'templateId');
                done();
            });
        })

        it('should return AccessDenied error if not authorized to write file on blob storage', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_templatesContainer}/templateId`))
                .reply(403, '', { 'x-ms-error-code': 'AuthorizationFailure' });

            storage.writeTemplate({}, {}, 'templateId', pathFileTxt, (err) => {
                assert.strictEqual(err.statusCode, 403);
                done();
            });
        });

        it('should return an error if file cannot be written on blob storage', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_templatesContainer}/templateId`))
                .reply(400, '', { 'x-ms-error-code': 'InvalidHeaderValue' });

            storage.writeTemplate({}, {}, 'templateId', pathFileTxt, (err) => {
                assert.strictEqual(err.statusCode, 400);
                done();
            });
        });
    })

    describe('readTemplate', () => {
        const toDelete = [];

        afterEach(() => {
            for (let i = 0; i < toDelete.length; i++) {
                const filePath = path.join(__dirname, 'data', toDelete[i]);

                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            toDelete.length = 0;
        });

        it('should read the template from blob storage', (done) => {
            const templateId = 'template.odt';
            const templatePath = path.join(__dirname, 'data', templateId);

            if (fs.existsSync(templatePath)) {
                fs.unlinkSync(templatePath);
            }

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_templatesContainer}/${templateId}`))
                .reply(200, 'Some content.\n', blobDownloadHeaders('Some content.\n'));

            storage.readTemplate({}, {}, templateId, (err, downloadedTemplatePath) => {
                assert.strictEqual(err, null);
                assert.strictEqual(path.basename(downloadedTemplatePath), templateId);
                assert.strictEqual(fs.existsSync(downloadedTemplatePath), true);
                assert.strictEqual(fs.readFileSync(downloadedTemplatePath, 'utf8'), 'Some content.\n');
                toDelete.push(path.basename(downloadedTemplatePath));
                done();
            });
        });

        it('should return NotFound error if file does not exist on blob storage', (done) => {
            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_templatesContainer}/missing-template.odt`))
                .reply(404, '', { 'x-ms-error-code': 'BlobNotFound' });

            storage.readTemplate({}, {}, 'missing-template.odt', (err) => {
                assert.strictEqual(err.statusCode, 404);
                done();
            });
        });

        it('should return an error if file cannot be read from blob', (done) => {
            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_templatesContainer}/invalid-template.odt`))
                .reply(400, '', { 'x-ms-error-code': 'InvalidHeaderValue' });

            storage.readTemplate({}, {}, 'invalid-template.odt', (err) => {
                assert.strictEqual(err.statusCode, 400);
                done();
            });
        });

        it('should not call the blob storage if file already exists in local folder', (done) => {
            const expectedPath = path.join('test', 'data', 'file.txt');

            storage.readTemplate({}, {}, 'file.txt', (err, templatePath) => {
                assert.strictEqual(err, null);
                assert.strictEqual(templatePath.endsWith(expectedPath), true);
                done();
            });
        });
    })

    describe('deletetemplate', () => {

        let templatePath = path.join(__dirname, 'data', 'template.docx');

        beforeEach(() => {
            fs.writeFileSync(templatePath, 'File content');
        });

        afterEach(() => {
            if (fs.existsSync(templatePath)) {
                fs.unlinkSync(templatePath);
            }
        });

        it('should delete the template from blob storage', (done) => {
            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_templatesContainer}`))
                .reply(202);

            const res = {};

            storage.deleteTemplate({}, res, 'template.docx', (err, deletedTemplatePath) => {
                assert.strictEqual(err, null);
                assert.strictEqual(deletedTemplatePath.endsWith(path.join('test', 'data', 'template.docx')), true);
                done();
            });
        });

        it('should return AccessDenied error if not authorized to delete from blob storage', (done) => {
            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_templatesContainer}`))
                .reply(403, '', { 'x-ms-error-code': 'AuthorizationFailure' });

            const res = {};

            storage.deleteTemplate({}, res, path.join('..', 'test', 'datas', 'template.docx'), (err) => {
                assert.strictEqual(err.statusCode, 403);
                done();
            });
        });

        it("should return an error if file cannot be deleted from blob storage", (done) => {
            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_templatesContainer}`))
                .reply(400, '', { 'x-ms-error-code': 'InvalidHeaderValue' });

            const res = {};

            storage.deleteTemplate({}, res, path.join('..', 'test', 'data', 'template.docx'), (err) => {
                assert.strictEqual(err.statusCode, 400);
                done();
            });
        });
    });

    describe('afterRender', () => {

        const _renderName = "whatever.pdf";
        const _expectedFilename = path.basename(pathFileTxt);

        it('should save the generated doccument into the renders container', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_expectedFilename}`))
                .reply(201);

            storage.afterRender({}, {}, null, pathFileTxt, _renderName, {}, (err) => {
                assert.strictEqual(err, undefined);
                done();
            });
        });

        it('should save a generated doccument into the renders containers even if the filename is not provided', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_expectedFilename}`))
                .reply(201);

            storage.afterRender({}, {}, null, pathFileTxt, '', {}, (err) => {
                assert.strictEqual(err, undefined);
                done();
            });
        });

        it('should return an error if the rendering fails', (done) => {
            storage.afterRender({}, {}, new Error('Something went wrong'), pathFileTxt, _renderName, {}, (err) => {
                assert.strictEqual(err.toString(), 'Error: Something went wrong');
                done();
            });
        });

        it('should return AccessDenied error if not authorized to save into the blob storage', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_expectedFilename}`))
                .reply(403, '', { 'x-ms-error-code': 'AuthorizationFailure' });

            storage.afterRender({}, {}, null, pathFileTxt, _renderName, {}, (err) => {
                assert.strictEqual(err.statusCode, 403);
                done();
            });
        });

        it('should return an error if the blob storage is not available', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_expectedFilename}`))
                .reply(400, '', { 'x-ms-error-code': 'InvalidHeaderValue' });

            storage.afterRender({}, {}, null, pathFileTxt, _renderName, {}, (err) => {
                assert.strictEqual(err.statusCode, 400);
                done();
            });
        });
    });

    describe('readRender', () => {

        const toDelete = [];

        afterEach(() => {
            for (let i = 0; i < toDelete.length; i++) {
                if (fs.existsSync(toDelete[i])) {
                    fs.unlinkSync(toDelete[i]);
                }
            }
            toDelete.length = 0;
        });

        it('should download the generated document from the cache folder and delete the file from blob storage', (done) => {

            const _renderName = 'whatever.pdf'

            fs.copyFileSync(path.join(__dirname, 'data', 'file.txt'), path.join(__dirname, 'data', _renderName))

            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(202);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                assert.strictEqual(null, err);
                assert.strictEqual(renderPath.includes(path.join('data', _renderName)), true)
                toDelete.push(renderPath);
                done();
            });
        });

        it('should download the generated document and delete it from blob storage', (done) => {

            const _renderName = 'downloaded.pdf';
            const _renderPath = path.join(__dirname, 'data', _renderName);

            if (fs.existsSync(_renderPath)) {
                fs.unlinkSync(_renderPath);
            }

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(200, 'Some content.\n', blobDownloadHeaders('Some content.\n'));

            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(202);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                assert.strictEqual(null, err);
                assert.strictEqual(renderPath.includes(path.join('data', _renderName)), true)
                toDelete.push(renderPath);
                done();
            });
        });

        it('should return an error if the file does not exist', (done) => {

            const _renderName = 'missing.pdf';

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(404, '', { 'x-ms-error-code': 'BlobNotFound' });

            storage.readRender({}, {}, _renderName, (err) => {
                assert.strictEqual(err.toString().includes('Error downloading blob'), true);
                done();
            });
        });

        it('should return AccessDenied if not authorized to read from blob storage', (done) => {
            const _renderName = 'forbidden.pdf';

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(403, '', { 'x-ms-error-code': 'AuthorizationFailure' });

            storage.readRender({}, {}, _renderName, (err) => {
                assert.strictEqual(err.toString().includes('Error downloading blob'), true);
                done();
            });
        });

        it('should return an error if the blob storage is not available', (done) => {
            const _renderName = 'invalid.pdf';

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(400, '', { 'x-ms-error-code': 'InvalidHeaderValue' });

            storage.readRender({}, {}, _renderName, (err) => {
                assert.strictEqual(err.toString().includes('Error downloading blob'), true);
                done();
            });
        });
    })
})

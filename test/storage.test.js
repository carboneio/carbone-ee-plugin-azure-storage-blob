const assert = require('assert');
const nock = require('nock');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const _rendersContainer = 'renders-container';
const _templatesContainer = 'templates-container';

const pathFileTxt = path.join(__dirname, 'data', 'file.txt');

const urlBlobStorage = 'https://whateverAccountName.blob.core.windows.net';

describe('Storage', () => {
    let storage = null;

    before(() => {

        config.setConfig({
            storageCredentials: {
                accountName: 'whateverAccountName',
                accountKey: 'whateverAccountKey'
            },
            rendersContainer: _rendersContainer,
            templatesContainer: _templatesContainer,
            templatePath: path.join(__dirname, 'data'),
            renderPath: path.join(__dirname, 'data')
        });

        nock(urlBlobStorage)
            .intercept(`/${_templatesContainer}`, "HEAD")
            .reply(200);

        nock(urlBlobStorage)
            .intercept(`/${_rendersContainer}`, "HEAD")
            .reply(200);

        storage = require('../storage');
    });

    describe('writeTemplate', () => {

        it('should write template on blob storage', () => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_templatesContainer}/templateId`))
                .reply(200);

            storage.writeTemplate({}, {}, 'templateId', pathFileTxt, (err, templateName) => {
                assert.strictEqual(err, null);
                assert.strictEqual(templateName, 'templateId');
            });
        })

        it('should return AccessDenied error if not authorized to write file on blob storage', () => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_templatesContainer}/templateId`))
                .reply(403);

            storage.writeTemplate({}, {}, 'templateId', pathFileTxt, (err) => {
                assert.strictEqual(err.toString().includes(403), true);
                assert.strictEqual(err.toString().includes('AccessDenied'), true);
            });
        });

        it('should return an error if file cannot be written on blob storage', () => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_templatesContainer}/templateId`))
                .replyWithError('Server unavailable');

            storage.writeTemplate({}, {}, 'templateId', pathFileTxt, (err) => {
                assert.strictEqual(err.toString(), 'reson: Server unavailable');
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
        });

        it('should read the template from blob storage', () => {
            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_templatesContainer}/`))
                .reply(200, () => {
                    return fs.createReadStream(pathFileTxt);
                });

            storage.readTemplate({}, {}, 'template.odt', (err, templatePath) => {
                assert.strictEqual(err, null);
                assert.strictEqual(path.basename(templatePath), 'template.odt');
                assert.strictEqual(fs.existsSync(templatePath), true);
                assert.strictEqual(fs.readFileSync(templatePath, 'utf8'), 'Some content.\n');
                toDelete.push(path.basename(templatePath));
            });
        });

        it('should return NotFound error if file does not exist on blob storage', () => {
            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_templatesContainer}/`))
                .reply(404);

            storage.readTemplate({}, {}, 'template.odt', (err) => {
                assert.strictEqual(err.toString().includes(404), true);
            });
        });

        it('should return an error if file cannot be read from blob', () => {
            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_templatesContainer}/`))
                .replyWithError('Server unavailable');

            storage.readTemplate({}, {}, 'template.odt', (err) => {
                assert.strictEqual(err.toString(), 'reson: Server unavailable');
            });
        });

        it('should not call the blob storage if file already exists in local folder', () => {
            const expectedPath = path.join('test', 'data', 'file.txt');

            storage.readTemplate({}, {}, 'file.txt', (err, templatePath) => {
                assert.strictEqual(err, null);
                assert.strictEqual(templatePath.endsWith(expectedPath), true);
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

        it('should delete the template from blob storage', () => {
            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_templatesContainer}`))
                .reply(200);

            const res = {
                send(result) {
                    assert.deepStrictEqual(result, {
                        success: true,
                        message: 'Template deleted'
                    });
                }
            };

            storage.deleteTemplate({}, res, 'template.docx', (err, templatePath) => {
                assert.strictEqual(err, null);
                assert.strictEqual(templatePath.endsWith('/test/data/template.docx'), true);
            });
        });

        it('should return AccessDenied error if not authorized to delete from blob storage', () => {
            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_templatesContainer}`))
                .reply(403);

            const res = {};

            storage.deleteTemplate({}, res, path.join('..', 'test', 'datas', 'template.docx'), (err) => {
                assert.strictEqual(err.toString().includes(403), true);
                assert.strictEqual(err.toString().includes('AccessDenied'), true);
            });
        });

        it("should return an error if file cannot be deleted from blob storage", () => {
            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_templatesContainer}`))
                .replyWithError('Server Unavailable');

            const res = {};

            storage.deleteTemplate({}, res, path.join('..', 'test', 'data', 'template.docx'), (err) => {
                assert.strictEqual(err.toString(), 'reson: Server unavailable');
            });
        });
    });

    describe('afterRender', () => {

        const _renderName = "whatever.pdf";
        const _expectedFilename = path.basename(pathFileTxt);

        it('should save the generated doccument into the renders container', () => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(200);

            storage.afterRender({}, {}, null, pathFileTxt, _renderName, {}, (err) => {
                assert.strictEqual(err, undefined);
            });
        });

        it('should save a generated doccument into the renders containers even if the filename is not provided', () => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_expectedFilename}`))
                .reply(200);

            storage.afterRender({}, {}, null, pathFileTxt, '', {}, (err) => {
                assert.strictEqual(err, undefined);
            });
        });

        it('should return an error if the rendering fails', () => {
            storage.afterRender({}, {}, new Error('Something went wrong'), pathFileTxt, _renderName, {}, (err) => {
                assert.strictEqual(err.toString(), 'Error: Something went wrong');
            });
        });

        it('should return AccessDenied error if not authorized to save into the blob storage', () => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(403);

            storage.afterRender({}, {}, null, pathFileTxt, _renderName, {}, (err) => {
                assert.strictEqual(err.toString().includes(403), true);
                assert.strictEqual(err.toString().includes('AccessDenied'), true);
            });
        });

        it('should return an error if the blob storage is not available', () => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .replyWithError('Server Unavailable');

            storage.afterRender({}, {}, null, pathFileTxt, _renderName, {}, (err) => {
                assert.strictEqual(err.toString(), 'reason: Server Unavailable');
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
        });

        it('should download the generated document from the cache folder and delete the file from blob storage', () => {

            const _renderName = 'whatever.pdf'

            fs.copyFileSync(path.join(__dirname, 'data', 'file.txt'), path.join(__dirname, 'data', _renderName))

            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(200);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                assert.strictEqual(null, err);
                assert.strictEqual(renderPath.includes('data/' + _renderName), true)
                toDelete.push(renderPath);
            });
        });

        it('should download the generated document and delete it from blob storage', () => {

            const _renderName = 'whatever.pdf';

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(200, () => {
                    return fs.createReadStream(pathFileTxt);
                });

            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(200);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                assert.strictEqual(null, err);
                assert.strictEqual(renderPath.includes('datasets/' + _renderName), true)
                toDelete.push(renderPath);
            });
        });

        it('should return an error if the file does not exist', () => {

            const _renderName = 'whatever.pdf';

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(404);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                assert.strictEqual('Error: File does not exist', err.toString());
            });
        });

        it('should return AccessDenied if not authorized to read from blob storage', () => {
            const _renderName = 'whatever.pdf';

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(403);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                assert.strictEqual(err.toString().includes(403), true);
                assert.strictEqual(err.toString().includes('AccessDenied'), true);
            });
        });

        it('should return an error if the blob storage is not available', () => {
            const _renderName = 'whatever.pdf';

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .replyWithError('Server Unavailable');

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                assert.strictEqual(err.toString(), 'reason: Server Unavailable');
            });
        });
    })
})



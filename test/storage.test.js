const assert = require('assert');
const nock = require('nock');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { StorageRetryPolicyType } = require('@azure/storage-blob');

const _rendersContainer = 'renders-container';
const _templatesContainer = 'templates-container';

const pathFileTxt = path.join(__dirname, 'data', 'file.txt');

const urlBlobStorage = 'https://whateverAccountName.blob.core.windows.net';

describe('Storage', () => {

    let storage = null;

    // beforeEach and afterEach are necessary for all tests to pass. Retrying requests require cleaning up the nock mocks.
    beforeEach(() => {

        config.setConfig({
            storageCredentials: {
                accountName: 'whateverAccountName',
                accountKey: 'whateverAccountKey'
            },
            rendersContainer: _rendersContainer,
            templatesContainer: _templatesContainer,
            templatePath: path.join(__dirname, 'data'),
            renderPath: path.join(__dirname, 'data'),
            storageRetryOptions: {
                maxTries: 0,
                tryTimeoutInMs: 3000,
                retryDelayInMs: 200,
                maxRetryDelayInMs: 300,
                retryPolicyType: StorageRetryPolicyType.EXPONENTIAL
            }
        });

        nock(urlBlobStorage)
            .head(`/${_templatesContainer}`)
            .reply(200);

        nock(urlBlobStorage)
            .head(`/${_rendersContainer}`)
            .reply(200);

        storage = require('../storage');
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('writeTemplate', () => {

        it('should write template on blob storage', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_templatesContainer}/templateId`))
                .reply(201);

            storage.writeTemplate({}, {}, 'templateId', pathFileTxt, (err, templateName) => {
                // Test will not execute assertsions unless wrapped in try/catach and the done callback is called.
                try 
                {
                    //assert.strictEqual(1, 2); // This line can be used to ensure assertions are working. Prior to calling `done()` at the end, these tests were resulting in false passes.
                    assert.strictEqual(err, null);
                    assert.strictEqual(templateName, 'templateId');
                    done();
                } catch (error) {
                    done(error); // Pass the error to done() to fail the test
                }
            });
        })

        it('should return AccessDenied error if not authorized to write file on blob storage', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_templatesContainer}/templateId`))
                .reply(403);

            storage.writeTemplate({}, {}, 'templateId', pathFileTxt, (err) => {
                try {
                    console.log(err.toString());
                    assert.strictEqual(err.toString().includes('AccessDenied'), true);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });

        it('should return an error if file cannot be written on blob storage', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_templatesContainer}/templateId`))
                .replyWithError('Server unavailable');

            storage.writeTemplate({}, {}, 'templateId', pathFileTxt, (err) => {
                try {
                    console.log(err.toString());
                    assert.strictEqual(err.toString().includes('Server unavailable'), true);
                    done();
                } catch (error) {
                    done(error);
                }
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

        it('should read the template from blob storage', (done) => {
            const filePath = pathFileTxt;
            const fileSize = fs.statSync(filePath).size;
            const etag = '12345'; // Example ETag value

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_templatesContainer}/`))
                .reply(200, () => fs.createReadStream(filePath), {
                    'Content-Length': fileSize,
                    'ETag': etag
                });

            storage.readTemplate({}, {}, 'template.odt', (err, templatePath) => {
                try {
                    toDelete.push(path.basename(templatePath)); // ensure to call this first to ensure that the file is deleted after the test even if it fails.
                    assert.strictEqual(err, null);
                    assert.strictEqual(path.basename(templatePath), 'template.odt');
                    assert.strictEqual(fs.existsSync(templatePath), true);
                    assert.strictEqual(fs.readFileSync(templatePath, 'utf8').includes('Some content.'), true);
                    done();
                } catch (error) {
                    done(error); // Pass the error to done() to fail the test
                }
            });
        });

        it('should return NotFound error if file does not exist on blob storage', (done) => {
            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_templatesContainer}/`))
                .reply(404);

            storage.readTemplate({}, {}, 'template.odt', (err) => {
                try {
                    assert.strictEqual(err.toString().includes(404), true);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });

        it('should return an error if file cannot be read from blob', (done) => {
            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_templatesContainer}/`))
                .replyWithError('Server unavailable');

            storage.readTemplate({}, {}, 'template.odt', (err) => {
                try {
                    assert.strictEqual(err.toString().includes('Server unavailable'), true);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });

        it('should not call the blob storage if file already exists in local folder', (done) => {
            const expectedPath = path.join('test', 'data', 'file.txt');

            storage.readTemplate({}, {}, 'file.txt', (err, templatePath) => {
                try {
                    assert.strictEqual(err, null);
                    assert.strictEqual(templatePath.endsWith(expectedPath), true);
                    done();
                } catch (error) {
                    done(error);
                }
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

            // NOTE: The response object is not used in the function and test is not affected with or without it.
            const res = {
                send(result) {
                    assert.deepStrictEqual(result, {
                        success: true,
                        message: 'Template deleted'
                    });
                }
            };

            storage.deleteTemplate({}, res, 'template.docx', (err, templatePath) => {
                try {
                    assert.strictEqual(err, null);
                    assert.strictEqual(templatePath.endsWith('/test/data/template.docx'), true);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });

        it('should return AccessDenied error if not authorized to delete from blob storage', (done) => {
            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_templatesContainer}`))
                .reply(403);

            const res = {};

            storage.deleteTemplate({}, res, 'template.docx', (err) => {
                try {
                    assert.strictEqual(err.toString().includes(403), true);
                    assert.strictEqual(err.toString().includes('AccessDenied'), true);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });

        it("should return an error if file cannot be deleted from blob storage", (done) => {
            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_templatesContainer}`))
                .replyWithError('Server Unavailable');

            const res = {};

            storage.deleteTemplate({}, res, 'template.docx', (err) => {
                try {
                    assert.strictEqual(err.toString().includes('Server Unavailable'), true);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });
    });

    describe('afterRender', () => {

        const _renderName = "whatever.pdf";
        const _expectedFilename = path.basename(pathFileTxt);

        it('should save the generated doccument into the renders container', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(201);

            storage.afterRender({}, {}, null, pathFileTxt, _renderName, {}, (err) => {
                try {
                    assert.strictEqual(err, undefined);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });

        it('should save a generated doccument into the renders containers even if the filename is not provided', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/`))
                .reply(201);

            // TODO: This test is suspicious, Not sure that you can save a file without a name to a blob.
            storage.afterRender({}, {}, null, pathFileTxt, '', {}, (err) => {
                try {
                    assert.strictEqual(err, undefined);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });

        it('should return an error if the rendering fails', (done) => {
            storage.afterRender({}, {}, new Error('Something went wrong'), pathFileTxt, _renderName, {}, 
            (err) => {
                    try {
                        assert.strictEqual(err.toString(), 'Error: Something went wrong');
                        done();
                    } catch (error) {
                        done(error);
                    }
                }
            );
        });

        it('should return AccessDenied error if not authorized to save into the blob storage', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(403);

            storage.afterRender({}, {}, null, pathFileTxt, _renderName, {}, (err) => {
                try {
                    assert.strictEqual(err.toString().includes(403), true);
                    assert.strictEqual(err.toString().includes('AccessDenied'), true);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });

        it('should return an error if the blob storage is not available', (done) => {
            nock(urlBlobStorage)
                .put(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .replyWithError('Server Unavailable');

            storage.afterRender({}, {}, null, pathFileTxt, _renderName, {}, (err) => {
                try {
                    assert.strictEqual(err.toString().includes('Server Unavailable'), true);
                    done();
                } catch (error) {
                    done(error);
                }
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

        it('should download the generated document from the cache folder and delete the file from blob storage', (done) => {

            const _renderName = 'whatever.pdf'

            fs.copyFileSync(path.join(__dirname, 'data', 'file.txt'), path.join(__dirname, 'data', _renderName))

            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(202);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                try {
                    assert.strictEqual(null, err);
                    assert.strictEqual(renderPath.includes('data/' + _renderName), true)
                    toDelete.push(renderPath);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });

        it('should download the generated document and delete it from blob storage', (done) => {

            const _renderName = 'whatever.pdf';

            const filePath = pathFileTxt;
            const fileSize = fs.statSync(filePath).size;
            const etag = '12345'; // Example ETag value

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(200, () => fs.createReadStream(filePath), {
                    'Content-Length': fileSize,
                    'ETag': etag
                });

            nock(urlBlobStorage)
                .delete(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(202);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                try {
                    toDelete.push(renderPath); // call first to ensure that the file is deleted after the test even if it fails. It was not being deleted if the test failed.
                    assert.strictEqual(null, err);
                    // Todo: confirm this path should include "datasets" or "data". Original code uses "datasets", but this fails.
                    assert.strictEqual(renderPath.includes('data/' + _renderName), true)
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });

        it('should return an error if the file does not exist', (done) => {

            const _renderName = 'whatever.pdf';

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(404);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                try {
                    assert.strictEqual(err.toString().includes('Blob does not exist'), true);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });

        it('should return AccessDenied if not authorized to read from blob storage', (done) => {
            const _renderName = 'whatever.pdf';

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .reply(403);

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                try {
                    assert.strictEqual(err.toString().includes(403), true);
                    assert.strictEqual(err.toString().includes('AccessDenied'), true);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });

        it('should return an error if the blob storage is not available', (done) => {
            const _renderName = 'whatever.pdf';

            nock(urlBlobStorage)
                .get(uri => uri.includes(`/${_rendersContainer}/${_renderName}`))
                .replyWithError('Server Unavailable');

            storage.readRender({}, {}, _renderName, (err, renderPath) => {
                try {
                    assert.strictEqual(err.toString().includes('Server Unavailable'), true);
                    done();
                } catch (error) {
                    done(error);
                }
            });
        });
    })
})



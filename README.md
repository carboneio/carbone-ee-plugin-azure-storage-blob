# Azure Blob Storage Plugin for Carbone On-premise
Store your templates and generated documents into Azure Blob Storage.

## Requirements
- Install Node 18.
- Create 2 Azure Blob Storage containers to store templates and renders (generated documents).
- Create an Azure Storage account and obtain the access keys.

## Setup
Create a plugin directory in the same directory as the carbone-ee binary.

```sh
mkdir plugin
```

Enter into the `plugin` directory.

```sh
cd plugin
```

Clone the repository.

```sh
git clone https://github.com/carboneio/carbone-ee-plugin-azure-blob-storage.git
```

Install npm packages.

```sh
npm install
```

Provide Azure Blob Storage configurations, as environment variables:

### Authorization with Shared Key
For local development only, not recommended for production deployments (e.g. Container Apps).

```dotenv
AZURE_STORAGE_ACCOUNT=STORAGE_ACCOUNT_NAME
AZURE_STORAGE_KEY=STORAGE_ACCOUNT_KEY
CONTAINER_TEMPLATES=STORAGE_CONTAINER_TEMPLATES
CONTAINER_RENDERS=STORAGE_RENDERS_CONTAINER
```

### Authorization with System-Assigned Managed Identity

```dotenv
AZURE_STORAGE_ACCOUNT=STORAGE_ACCOUNT_NAME
CONTAINER_TEMPLATES=STORAGE_CONTAINER_TEMPLATES
CONTAINER_RENDERS=STORAGE_RENDERS_CONTAINER
```

### Authorization with User-Assigned Managed Identity

```dotenv
AZURE_STORAGE_ACCOUNT=STORAGE_ACCOUNT_NAME
AZURE_MANAGED_IDENTITY_CLIENT_ID="Client ID of user_assigned_identity"
CONTAINER_TEMPLATES=STORAGE_CONTAINER_TEMPLATES
CONTAINER_RENDERS=STORAGE_RENDERS_CONTAINER
```

### Authorization with Default Azure Credentials

```dotenv
AZURE_STORAGE_ACCOUNT=STORAGE_ACCOUNT_NAME
AZURE_USE_DEFAULT_AZURE_CREDENTIALS="true"
CONTAINER_TEMPLATES=STORAGE_CONTAINER_TEMPLATES
CONTAINER_RENDERS=STORAGE_RENDERS_CONTAINER
```

Then set the additional environment variables that are needed for DefaultAzureCredential to work. They are [documented here](https://learn.microsoft.com/en-us/javascript/api/overview/azure/identity-readme?view=azure-node-latest#environment-variables).

### Connection to Azure Storage Emulators

When using local emulators, use `AZURE_STORAGE_CONNECTION_STRING` instead of `AZURE_STORAGE_ACCOUNT`:

```dotenv
AZURE_STORAGE_CONNECTION_STRING=<connection string>
CONTAINER_TEMPLATES=STORAGE_CONTAINER_TEMPLATES
CONTAINER_RENDERS=STORAGE_RENDERS_CONTAINER
```

The azurite emulator default connection string can be [found here](https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite#production-style-url):

```text
DefaultEndpointsProtocol=http;AccountName=account1;AccountKey=key1;BlobEndpoint=http://account1.blob.localhost:10000;QueueEndpoint=http://account1.queue.localhost:10001;TableEndpoint=http://account1.table.localhost:10002;
```

## Strict Mode

By default, Carbone is not stopped if access to blob storage fails.
You can force exit by setting strict mode:

```dotenv
STORAGE_STRICT_MODE=true
```

## Testing the Plugin Locally with Docker

To test local changes without cloning/building the plugin separately, you can run Carbone EE directly from the root of this repository by mounting the current directory as the plugin folder (`-v ./:/app/plugin`):

```sh
docker run -it --rm \
  -e CARBONE_USE_S3_PLUGIN=false \
  -v ./:/app/plugin \
  -e CARBONE_TEMPLATE_MANAGEMENT=true \
  -e CARBONE_EE_STUDIO=true \
  -e CARBONE_EE_LICENSE \
  -p 4000:4000 \
  -e AZURE_STORAGE_ACCOUNT=carboneconnector \
  -e CONTAINER_TEMPLATES=templates \
  -e CONTAINER_RENDERS=renders \
  -e AZURE_STORAGE_CONNECTION_STRING="<connection string>" \
  carbone/carbone-ee:full-5.9.1
```

Notes:
- Run this command from the root of the cloned `carbone-ee-plugin-azure-storage-blob` repository, since `./` refers to the current working directory.
- `CARBONE_USE_S3_PLUGIN=false` disables the built-in S3 storage plugin so this Azure plugin is used instead.
- `CARBONE_TEMPLATE_MANAGEMENT=true` and `CARBONE_EE_STUDIO=true` enable the template management API and Carbone Studio UI, useful for manually uploading templates and triggering renders while testing.
- `-e CARBONE_EE_LICENSE` (without a value) forwards the `CARBONE_EE_LICENSE` environment variable from your host shell into the container. Export it beforehand, e.g. `export CARBONE_EE_LICENSE=<your license key>`.
- This example authenticates with `AZURE_STORAGE_CONNECTION_STRING` (see [Connection to Azure Storage Emulators](#connection-to-azure-storage-emulators)), which takes priority over `AZURE_STORAGE_ACCOUNT`/`AZURE_STORAGE_KEY`. You can swap in any of the [authentication methods](#authorization-with-shared-key) described above instead.
- `-it --rm` runs the container in the foreground and removes it on exit, so `Ctrl+C` stops the test run and cleans up.

Finally, start the Carbone Server, and the following logs will appear. If the connection fails or something goes wrong, an error message will be logged.

## Environment Variables
The plugin supports the following environment variables to change the configuration file name and path:

- `CARBONE_AST_CONFIG`: Specify a custom-named configuration file; the default filename is `config.json`.
- `CARBONE_AST_CONFIG_PATH`: Specify a custom path to the configuration file; the default path is the Carbone Config directory `./config`.

# Azure Blob Storage Plugin for Carbone On-premise
Store your templates and generated documents into Azure Blob Storage.

## Requirements
Install Node 18
Create 2 Azure Blob Storage containers to store templates and renders (generated documents).
Create an Azure Storage account and obtain the access keys.

## Setup
Create a plugin directory in the same directory as the carbone-ee binary.

```sh
mkdir plugin
```

Enter into the `plugin` directory

```sh
cd plugin
```

Clone the repository

```sh
git clone https://github.com/carboneio/carbone-ee-plugin-azure-blob-storage.git
```

Install Npm Packages

```sh
npm install
```

Provide Azure Blob Storage configurations, as environment variables:

### Authorization with Shared Key (for local developpemen not recommended for Container app production deployement)
```dotenv
AZURE_STORAGE_ACCOUNT=STORAGE_ACCOUNT_NAME
AZURE_STORAGE_KEY=STORAGE_ACCOUNT_KEY
CONTAINER_TEMPLATES=STORAGE_CONTAINER_TEMPLATES
CONTAINER_RENDERS=STORAGE_RENDERS_CONTAINER
```

### Authorization with System managed Identity
```dotenv
AZURE_STORAGE_ACCOUNT=STORAGE_ACCOUNT_NAME
CONTAINER_TEMPLATES=STORAGE_CONTAINER_TEMPLATES
CONTAINER_RENDERS=STORAGE_RENDERS_CONTAINER
```

### Authorization with User managed Identity
```dotenv
AZURE_STORAGE_ACCOUNT=STORAGE_ACCOUNT_NAME
AZURE_MANAGED_IDENTITY_CLIENT_ID="Client ID of user_assigned_identity
CONTAINER_TEMPLATES=STORAGE_CONTAINER_TEMPLATES
CONTAINER_RENDERS=STORAGE_RENDERS_CONTAINER
```

## Strict mode

By default, Carbone is not stopped if access to blob storage fail.
You can force exit by setting strict mode :
```dotenv
STORAGE_STRICT_MODE=true
```

If you are using **Carbone Docker**, you have to mount the plugin directory as a volume into the container, and you have to define environment variables for Azure Blob Storage credentials

Command for Docker CLI:

```sh
docker run --name carbone -p 4000:4000 -e LANG=C.UTF-8 -v ./plugin:/app/plugin -e AZURE_STORAGE_ACCOUNT=<STORAGE_ACCOUNT_NAME> -e AZURE_STORAGE_KEY=<STORAGE_ACCOUNT_KEY> -e CONTAINER_TEMPLATES='templates' -e CONTAINER_RENDERS='renders' carbone/carbone-ee
```

File for Docker-compose:


```yml
version: "3.9"
services:
  carbone:
    image: carbone/carbone-ee:latest
    platform: linux/amd64
    ports:
      - "4000:4000"
    volumes:
      - ./plugin:/app/plugin
    environment:
      - LANG=C.UTF-8
      - AZURE_STORAGE_ACCOUNT=STORAGE_ACCOUNT_NAME
      - AZURE_STORAGE_KEY=STORAGE_ACCOUNT_KEY
      - CONTAINER_TEMPLATES=STORAGE_CONTAINER_TEMPLATES
      - CONTAINER_RENDERS=STORAGE_RENDERS_CONTAINER
```

Finally start the Carbone Server, and the following logs will appear. If the connection fails or something goes wrong, an error message will be logged.

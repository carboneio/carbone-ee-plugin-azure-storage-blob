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


```dotenv
AZURE_STORAGE_ACCOUNT=STORAGE_ACCOUNT_NAME
AZURE_STORAGE_KEY=STORAGE_ACCOUNT_KEY
CONTAINER_TEMPLATES=STORAGE_CONTAINER_TEMPLATES
CONTAINER_RENDERS=STORAGE_RENDERS_CONTAINER
```

If you are using **Carbone Docker**, you have to mount the plugin directory as a volume into the container, and you have to define environment variables for Azure Blob Storage credentials

Command for Docker CLI:

```sh
docker run --platform linux/amd64 --name carbone -p 4000:4000 -e LANG=C.UTF-8 -v ./plugin:/app/plugin -e AZURE_STORAGE_ACCOUNT=<STORAGE_ACCOUNT_NAME> -e AZURE_STORAGE_KEY=<STORAGE_ACCOUNT_KEY> -e CONTAINER_TEMPLATES='templates' -e CONTAINER_RENDERS='renders' carbone/carbone-ee
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


## Environment Variables
The plugin supports the following environment variables to change the configuration file name and path:


* `CARBONE_AST_CONFIG`: Specify a custom-named configuration file; the default filename is `config.json`.
* `CARBONE_AST_CONFIG_PATH`: Specify a custom path to the configuration file; the default path is the Carbone Config directory `./config`.

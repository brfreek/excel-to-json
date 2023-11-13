# Excel to JSON Mendix and AWS SAM

This repository contains the source code and configuration to run the serverless application model (SAM) that transforms excel files into JSON. The goal of this serverless application is to provide other external applications with the tools to efficiently transform and consume large excel files that are for instance not manageable by the target system. The example in this case is a Mendix Low code application that will run out of memory with a 500k row excel sheet. Where this solution provides a cheap and efficient way of consuming the data from the Excel file.

Among the services used are 
* Amazon S3, for storing the input Excel files and output JSON files.
* Amazon SQS, for communication between the SAM and target system about finished jobs
* AWS Lambda, for running the required code to extract the data from Excel and storing it in JSON files.

As JSON files are much larger than Excel files, the Lambda function will split the excel file in separate JSON files per 10.000 rows. 

## Prerequisites
In order to run this application you will need the following:
* An active AWS Account
* AWS CLI - [Install the AWS CLI](https://aws.amazon.com/cli/)
* Node.js - [Install Node.js 18](https://nodejs.org/en/), including the NPM package management tool.
* Docker - [Install Docker community edition](https://hub.docker.com/search/?type=edition&offering=community)
* SAM CLI - [Install the SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)


Not required but very useful if you use Visual Studio Code: 
* AWS Toolkit for Visual Studio Code (https://aws.amazon.com/visualstudiocode/)

## Deploy the application

The Serverless Application Model Command Line Interface (SAM CLI) is an extension of the AWS CLI that adds functionality for building and testing Lambda applications. It uses Docker to run your functions in an Amazon Linux environment that matches Lambda. It can also emulate your application's build environment and API.

To build and deploy your application for the first time, run the following in your shell:

```bash
sam build
sam deploy --guided
```

The first command will build a docker image from a Dockerfile and then the source of your application inside the Docker image. The second command will package and deploy your application to AWS, with a series of prompts:

* **Stack Name**: The name of the stack to deploy to CloudFormation. This should be unique to your account and region, and a good starting point would be something matching your project name.
* **AWS Region**: The AWS region you want to deploy your app to.
* **Confirm changes before deploy**: If set to yes, any change sets will be shown to you before execution for manual review. If set to no, the AWS SAM CLI will automatically deploy application changes.
* **Allow SAM CLI IAM role creation**: Many AWS SAM templates, including this example, create AWS IAM roles required for the AWS Lambda function(s) included to access AWS services. By default, these are scoped down to minimum required permissions. To deploy an AWS CloudFormation stack which creates or modifies IAM roles, the `CAPABILITY_IAM` value for `capabilities` must be provided. If permission isn't provided through this prompt, to deploy this example you must explicitly pass `--capabilities CAPABILITY_IAM` to the `sam deploy` command.
* **Save arguments to samconfig.toml**: If set to yes, your choices will be saved to a configuration file inside the project, so that in the future you can just re-run `sam deploy` without parameters to deploy changes to your application.

Once the deployment is finished you will be able to view the resources in your AWS Account and verify if the setup is completed.
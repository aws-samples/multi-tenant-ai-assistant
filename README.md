# Implementing tenant isolation using Agents for Amazon Bedrock in a multi-tenant environment

This repository is a companion to the blog post [Implementing tenant isolation using Agents for Amazon Bedrock in a multi-tenant environment](https://aws.amazon.com/blogs/machine-learning/implementing-tenant-isolation-using-agents-for-amazon-bedrock-in-a-multi-tenant-environment/). Read through this blog post for an architecture overview, a step-by-step guide to deploy the application in your own AWS account, and a close-up look into different code sections.


The repository also contains reference implementations of the following related aspects, which you may use to inspire your own implementation:
- Building a fully serverless AI assistant
- Setting up Agents for Amazon Bedrock from scratch using AWS Cloud Development Kit (CDK)
- Converting response streams from Amazon Bedrock into GraphQL mutations and subscriptions
- Connecting frontend applications to Amazon Bedrock through GraphQL with AWS AppSync
- Securing AWS AppSync APIs with fine grained access control 


The repository contains three main elements:
- An AWS CDK stack for deploying the infrastructure.
- A frontend application that you can run locally for a chatbot user interface.
- A script `manage-orders.sh` to manipulate data for testing purposes.

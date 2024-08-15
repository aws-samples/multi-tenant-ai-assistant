import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import * as cdk from "aws-cdk-lib";
import * as fs from "fs";
import { CfnOutput, Duration, RemovalPolicy, StackProps } from "aws-cdk-lib";
import {
    AuthorizationType,
    Code,
    Definition,
    EventBridgeDataSource,
    FunctionRuntime,
    GraphqlApi,
    NoneDataSource,
} from "aws-cdk-lib/aws-appsync";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import {
    AccountRecovery,
    AdvancedSecurityMode,
    CfnUserPoolGroup,
    CfnUserPoolUser,
    LambdaVersion,
    StringAttribute,
    UserPool,
    UserPoolClient,
    UserPoolOperation,
    VerificationEmailStyle,
} from "aws-cdk-lib/aws-cognito";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { CfnAgent, CfnAgentAlias } from "aws-cdk-lib/aws-bedrock";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { ArnPrincipal, Effect, ManagedPolicy, Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal, SessionTagsPrincipal, } from "aws-cdk-lib/aws-iam";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId, } from "aws-cdk-lib/custom-resources";
import * as path from "node:path";
import { NagSuppressions } from "cdk-nag";
import { RetentionDays } from "aws-cdk-lib/aws-logs";

import * as crypto from "crypto-js";


export class MultiTenantAiAssistantStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        const tenants = ["tenant1", "tenant2", "tenant3"];

        interface Policies {
            returns: {
                days: number
            }
        }

        const tenantItems: {
            tenantId: { S: string };
            ordersTableName: { S: string };
            policies: {
                M: {
                    returns: {
                        M: {
                            days: { N: string }
                        }
                    }
                }
            }
        }[] = [];


        const tenantConfigurationTable = new Table(
            this,
            "tenantConfigurationTable",
            {
                removalPolicy: RemovalPolicy.DESTROY,
                partitionKey: {
                    name: "tenantId",
                    type: AttributeType.STRING,
                },
                billingMode: BillingMode.PAY_PER_REQUEST,
            }
        );

        const agentTaskLambda = new PythonFunction(this, 'agentTaskLambda', {
            runtime: Runtime.PYTHON_3_12,
            entry: "./src/agentTask/",
            environment: {
                TENANT_CONFIG_TABLE_NAME: tenantConfigurationTable.tableName,
            },
        });

        const agentRole = new Role(this, "AgentRole", {
            roleName: "AmazonBedrockExecutionRoleForAgents_MultiTenantAgent",
            assumedBy: new ServicePrincipal("bedrock.amazonaws.com"),
            inlinePolicies: {
                Bedrock: new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            actions: ["bedrock:InvokeModel"],
                            resources: [
                                `arn:aws:bedrock:*:${this.account}:provisioned-model/*`,
                                "arn:aws:bedrock:*::foundation-model/*",
                                `arn:aws:bedrock:*:${this.account}:guardrail/*`
                            ],
                        }),
                    ],
                }),
            },
        });

        const agent = new CfnAgent(this, "Agent", {
            agentName: "store-assistant",
            instruction: "You’re a friendly, helpful AI assistant for an online store that is used by customers to ask questions about the store and also access customer-specific information. You can assume that customer identity such as a user ID is passed in a secure way to the different tools at your disposal, so you never need to ask for this information.",
            actionGroups: [
                {
                    actionGroupName: "access-store-and-user-data",
                    actionGroupExecutor: {
                        lambda: agentTaskLambda.functionArn
                    },
                    actionGroupState: "ENABLED",
                    apiSchema: {
                        payload: fs.readFileSync(`./src/agentTask/schema.yaml`).toString()
                    }
                }
            ],
            agentResourceRoleArn: agentRole.roleArn,
            autoPrepare: true,
            foundationModel: "anthropic.claude-3-sonnet-20240229-v1:0",
        })

        const agentAlias = new CfnAgentAlias(this, "AgentAlias", {
            agentId: agent.attrAgentId,
            agentAliasName: "store-assistant-alias",
        })


        agentTaskLambda.addPermission("AllowCallByBedrockAgent", {
            principal: new ServicePrincipal("bedrock.amazonaws.com"),
            sourceAccount: this.account,
            sourceArn: `arn:aws:bedrock:${this.region}:${this.account}:agent/*`,
        });


        const preTokenGenerationLambda = new PythonFunction(
            this,
            "preTokenLambda",
            {
                runtime: Runtime.PYTHON_3_12,
                entry: "./src/preTokenGeneration/",
            }
        );
        const userPool = new UserPool(this, "userpool", {
            selfSignUpEnabled: true,
            accountRecovery: AccountRecovery.EMAIL_ONLY,
            userVerification: {
                emailSubject: "Verify your email for our app!",
                emailBody:
                    "Hello {username}, Thanks for signing up to our app! Your verification code is {####}",
                emailStyle: VerificationEmailStyle.CODE,
            },
            autoVerify: { email: true },
            userPoolName: "ai-assistant-userpool",
            removalPolicy: RemovalPolicy.DESTROY,
            customAttributes: {
                tenantId: new StringAttribute({ minLen: 5, maxLen: 15, mutable: true }),
            },
            advancedSecurityMode: AdvancedSecurityMode.ENFORCED,
            passwordPolicy: {
                minLength: 8,
                requireDigits: true,
                requireUppercase: true,
                requireLowercase: true,
                requireSymbols: true
            }
        });
        userPool.addTrigger(
            UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
            preTokenGenerationLambda,
            LambdaVersion.V2_0
        );

        tenants.map((tenant) => {
            const group = new CfnUserPoolGroup(this, `${tenant}-group`, {
                userPoolId: userPool.userPoolId,
                groupName: tenant,
            });
            const orderTableName = `${tenant}-orders`;
            const orderTable = new Table(this, orderTableName, {
                removalPolicy: RemovalPolicy.DESTROY,
                partitionKey: {
                    name: "userId",
                    type: AttributeType.STRING,
                },
                sortKey: {
                    name: "orderId",
                    type: AttributeType.STRING,
                },
                billingMode: BillingMode.PAY_PER_REQUEST,
                tableName: orderTableName,
            });
            tenantItems.push({
                tenantId: { S: tenant },
                ordersTableName: { S: orderTableName },
                policies: {
                    M: {
                        returns: {
                            M: {
                                days: { N: parseInt(tenant.slice(-1)) * 10 + "" } // 10, 20, or 30 days
                            }
                        }
                    }
                }
            });

            const username = `${tenant}-user`;
            const user = new CfnUserPoolUser(this, username, {
                userPoolId: userPool.userPoolId,
                username: username,
                userAttributes: [
                    {
                        name: "custom:tenantId",
                        value: tenant,
                    },
                ],
            });
            const hash = crypto.MD5(tenant + this.account)
            const password = `Initial-${hash}`

            const secretNameOutput = new CfnOutput(this, `${tenant}Password`, {
                value: password,
                description: 'Initial password to login, must be changed at first login'
            })

            const setPasswordCall = {
                service: "CognitoIdentityServiceProvider",
                action: "AdminSetUserPassword",
                parameters: {
                    Password: password,
                    Username: username,
                    UserPoolId: userPool.userPoolId,
                    Permanent: "false",
                },
                physicalResourceId: PhysicalResourceId.of(`${tenant}-password`),
            }
            const userPassword = new AwsCustomResource(this, `${tenant}-password`, {
                onCreate: setPasswordCall,
                onUpdate: setPasswordCall,
                policy: AwsCustomResourcePolicy.fromStatements([
                    new PolicyStatement({
                        actions: ['cognito-idp:AdminSetUserPassword'],
                        resources: [`arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${userPool.userPoolId}`],
                        effect: Effect.ALLOW
                    })
                ])
            });
        });
        addItems(this, tenantConfigurationTable, tenantItems);

        const userPoolClient = new UserPoolClient(this, "appClient", {
            userPool,
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
        });

        const api = new GraphqlApi(this, "Api", {
            name: "ai-assistant",
            definition: Definition.fromFile(
                path.join(__dirname, "./schema.graphql")
            ),
            logConfig: {
                retention: RetentionDays.THREE_DAYS
            },
            authorizationConfig: {
                defaultAuthorization: {
                    authorizationType: AuthorizationType.USER_POOL,
                    userPoolConfig: {
                        userPool: userPool,
                    },
                },
                additionalAuthorizationModes: [
                    {
                        authorizationType: AuthorizationType.IAM,
                    },
                ],
            },
        });

        const eventBus = new EventBus(this, "eventBus");

        const eventBridgeDataSource = new EventBridgeDataSource(
            this,
            "eventBridgeSource",
            {
                api: api,
                eventBus: eventBus,
            }
        );

        const noneAnswerSource = new NoneDataSource(this, "noneAnswerSource", {
            api,
        });

        noneAnswerSource.createResolver("onAnswerStatusResolver", {
            fieldName: "answerUpdate",
            typeName: "Subscription",
            runtime: FunctionRuntime.JS_1_0_0,
            code: Code.fromInline(`
      export function request(ctx) {
        if (!ctx.args.answerId.startsWith(ctx.identity.sub + ".")) {
          util.unauthorized()
        }
        return {
          payload: ctx.args,
        };
      }
      export const response = (ctx) => ctx.result;   
      `),
        });

        noneAnswerSource.createResolver("updateAnswerResolver", {
            fieldName: "newAnswerChunk",
            typeName: "Mutation",
            runtime: FunctionRuntime.JS_1_0_0,
            code: Code.fromInline(`
      export const request = (ctx) => ({ payload: ctx.args });
      export const response = (ctx) => ctx.result; 
      `),
        });

        const eventBridgeSource = "multi-tenant-ai-assistant";
        eventBridgeDataSource.createResolver("askQuestion", {
            fieldName: "newPrompt",
            typeName: "Mutation",
            runtime: FunctionRuntime.JS_1_0_0,
            code: Code.fromInline(`
      export function request(ctx) {
        if (!ctx.args.answerId.startsWith(ctx.identity.sub + ".")) {
          util.unauthorized()
        }
        return {
          operation: "PutEvents",
          events: [
            {
              source: "${eventBridgeSource}",
              detail: {
                arguments: ctx.arguments,
                identity: ctx.identity,
              },
              detailType: "newPrompt",
            },
          ],
        };
      }
      export function response(ctx) {
        if (ctx.error) util.error(ctx.error.message, ctx.error.type, ctx.result);
        else return ctx.result;
      }
      
      `),
        });
        const invokeAgentRule = new Rule(this, "questionAnsweringRule", {
            description: "Rule to trigger question answering function",
            eventBus: eventBus,
            eventPattern: {
                source: [eventBridgeSource],
            },
        });

        const invokeAgentLambdaRole = new Role(this, "InvokeAgentLambdaRole", {
            assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        })

        // will be assumed by invokeAgentLambda to pass tenant-specific credentials to agentTaskLambda
        const accessTenantDataRole = new Role(this, "AccessTenantData", {
            assumedBy: new SessionTagsPrincipal(new ArnPrincipal(invokeAgentLambdaRole.roleArn)),
            inlinePolicies: {
                "AccessTenantConfiguration": new PolicyDocument(
                    {
                        statements: [
                            new PolicyStatement({
                                actions: ["dynamodb:Query"],
                                resources: [tenantConfigurationTable.tableArn],
                                conditions: {
                                    "ForAllValues:StringEquals": {
                                        "dynamodb:LeadingKeys": [
                                            "${aws:PrincipalTag/TenantId}"
                                        ]
                                    }
                                }
                            })
                        ],

                    }
                ),
                "AccessOrderData": new PolicyDocument(
                    {
                        statements: [
                            new PolicyStatement({
                                actions: ["dynamodb:Query"],
                                resources: ["arn:aws:dynamodb:*:*:table/${aws:PrincipalTag/TenantId}-orders"]
                            })
                        ]
                    }
                ),
            }
        })

        invokeAgentLambdaRole.attachInlinePolicy(new Policy(this, "AssumeAccessTenantDataRole", {
            statements: [
                new PolicyStatement({
                    actions: ["sts:AssumeRole", "sts:TagSession"],
                    resources: [accessTenantDataRole.roleArn]
                })
            ]
        }))

        const invokeAgentLambda = new PythonFunction(
            this,
            "invokeAgentLambda",
            {
                runtime: Runtime.PYTHON_3_12,
                entry: "./src/invokeAgent/",
                environment: {
                    AGENT_ID: agent.attrAgentId, //This will be replaced by user in UI
                    AGENT_ALIAS_ID: agentAlias.attrAgentAliasId, //This will be replaced by user in UI
                    GRAPHQL_URL: api.graphqlUrl,
                    ACCESS_TENANT_DATA_ROLE_ARN: accessTenantDataRole.roleArn
                },
                timeout: Duration.minutes(1),
                role: invokeAgentLambdaRole
            }
        );

        api.grantMutation(invokeAgentLambda);

        invokeAgentRule.addTarget(new LambdaFunction(invokeAgentLambda));

        invokeAgentLambda.role?.attachInlinePolicy(
            new Policy(this, "InvokeAgent", {
                statements: [
                    new PolicyStatement({
                        actions: ["bedrock:InvokeAgent"],
                        resources: ["*"],
                    }),
                ],
            })
        );


        //OUTPUTS

        const userPoolId = new CfnOutput(this, "userPoolId", {
            value: userPool.userPoolId,
            description: "Cognito userpool id",
        });

        const appClientId = new CfnOutput(this, "appClientId", {
            value: userPoolClient.userPoolClientId,
            description: "Cognito client id",
        });

        const graphqlEndpoint = new CfnOutput(this, "graphqlEndpoint", {
            value: api.graphqlUrl,
            description: "GraphQL endpoint",
        });

        const tenantConfigurationTableName = new CfnOutput(this, 'tenantConfigurationTableName', {
            value: tenantConfigurationTable.tableName,
            description: 'Table name for tenant information'
        })


        //CDK NAG

        NagSuppressions.addStackSuppressions(this, [
            {
                id: 'AwsSolutions-DDB3',
                reason: 'Not required for demo purposes'
            },
        ])

        NagSuppressions.addStackSuppressions(this, [
            {
                id: 'AwsSolutions-IAM5',
                reason: 'Not required for demo purposes. Handled by CDK Custom resource construct.'
            },
        ])

        NagSuppressions.addStackSuppressions(this, [
            {
                id: 'AwsSolutions-L1',
                reason: 'Manged by custom resource construct.'
            },
        ])
        NagSuppressions.addStackSuppressions(this, [
            {
                id: 'AwsSolutions-COG2',
                reason: 'Not needed for demo purposes'
            },
        ])
        NagSuppressions.addStackSuppressions(this, [
            {
                id: 'AwsSolutions-S1',
                reason: 'Not needed for demo purposes'
            },
        ])
        NagSuppressions.addStackSuppressions(this, [
            {
                id: 'AwsSolutions-IAM4',
                reason: 'Lambda execution role'
            },
        ])
        NagSuppressions.addStackSuppressions(this, [
            {
                id: 'AwsSolutions-SMG4',
                reason: 'Secret rotation not needed, as secret can only be used once'
            },
        ])
    }
}

function addItems(stack: cdk.Stack, table: Table, items: any[]) {
    const createItems = new AwsCustomResource(stack, "createTenantItems", {
        onUpdate: {
            service: "DynamoDB",
            action: "BatchWriteItem",
            parameters: {
                RequestItems: {
                    [table.tableName]: items.map((item) => {
                        return {
                            PutRequest: {
                                Item: item,
                            },
                        };
                    }),
                },
            },
            physicalResourceId: PhysicalResourceId.of(Date.now().toString()),
        },
        policy: AwsCustomResourcePolicy.fromStatements([
            new PolicyStatement({
                actions: ['dynamodb:BatchWriteItem'],
                resources: [table.tableArn],
                effect: Effect.ALLOW
            })
        ]),
    });
    createItems.node.addDependency(table);
}



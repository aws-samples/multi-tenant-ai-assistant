import { Amplify } from "aws-amplify";
import cdkOutput from "../cdk/cdk-output.json";

if (!cdkOutput.MultiTenantAiAssistantStack) {
  throw new Error("CDK output not found, please deploy infrastructure first");
}

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: cdkOutput.MultiTenantAiAssistantStack.userPoolId,
      userPoolClientId: cdkOutput.MultiTenantAiAssistantStack.appClientId,
      signUpVerificationMethod: "code",
    },
  },
  API: {
    GraphQL: {
      endpoint: cdkOutput.MultiTenantAiAssistantStack.graphqlEndpoint,
      region: cdkOutput.MultiTenantAiAssistantStack.regionOutput,
      defaultAuthMode: "userPool",
    },
  },
});

export const currentConfig = Amplify.getConfig();

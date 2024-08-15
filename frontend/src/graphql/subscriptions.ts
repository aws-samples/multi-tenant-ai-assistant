/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const answerUpdate = /* GraphQL */ `subscription AnswerUpdate($answerId: ID!) {
  answerUpdate(answerId: $answerId) {
    answerId
    answerChunk
    answerStatus
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.AnswerUpdateSubscriptionVariables,
  APITypes.AnswerUpdateSubscription
>;

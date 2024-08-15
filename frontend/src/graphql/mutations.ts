/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const newPrompt = /* GraphQL */ `mutation NewPrompt($answerId: ID!, $prompt: String!, $answerStatus: String) {
  newPrompt(answerId: $answerId, prompt: $prompt, answerStatus: $answerStatus) {
    answerId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.NewPromptMutationVariables,
  APITypes.NewPromptMutation
>;
export const newAnswerChunk = /* GraphQL */ `mutation NewAnswerChunk(
  $answerId: ID!
  $answerStatus: String!
  $answerChunk: String!
) {
  newAnswerChunk(
    answerId: $answerId
    answerStatus: $answerStatus
    answerChunk: $answerChunk
  ) {
    answerId
    answerChunk
    answerStatus
    __typename
  }
}
` as GeneratedMutation<
  APITypes.NewAnswerChunkMutationVariables,
  APITypes.NewAnswerChunkMutation
>;

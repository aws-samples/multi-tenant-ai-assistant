/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getAnswer = /* GraphQL */ `query GetAnswer($answerId: ID) {
  getAnswer(answerId: $answerId) {
    answerId
    answerChunk
    answerStatus
    __typename
  }
}
` as GeneratedQuery<APITypes.GetAnswerQueryVariables, APITypes.GetAnswerQuery>;

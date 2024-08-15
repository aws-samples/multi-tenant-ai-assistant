/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type NewPromptCreated = {
  __typename: "NewPromptCreated",
  answerId?: string | null,
};

export type AnswerChunk = {
  __typename: "AnswerChunk",
  answerId: string,
  answerChunk: string,
  answerStatus: string,
};

export type NewPromptMutationVariables = {
  answerId: string,
  prompt: string,
  answerStatus?: string | null,
};

export type NewPromptMutation = {
  newPrompt?:  {
    __typename: "NewPromptCreated",
    answerId?: string | null,
  } | null,
};

export type NewAnswerChunkMutationVariables = {
  answerId: string,
  answerStatus: string,
  answerChunk: string,
};

export type NewAnswerChunkMutation = {
  newAnswerChunk?:  {
    __typename: "AnswerChunk",
    answerId: string,
    answerChunk: string,
    answerStatus: string,
  } | null,
};

export type GetAnswerQueryVariables = {
  answerId?: string | null,
};

export type GetAnswerQuery = {
  getAnswer?:  {
    __typename: "AnswerChunk",
    answerId: string,
    answerChunk: string,
    answerStatus: string,
  } | null,
};

export type AnswerUpdateSubscriptionVariables = {
  answerId: string,
};

export type AnswerUpdateSubscription = {
  answerUpdate?:  {
    __typename: "AnswerChunk",
    answerId: string,
    answerChunk: string,
    answerStatus: string,
  } | null,
};

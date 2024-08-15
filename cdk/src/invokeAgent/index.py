import json
import logging
import os

import boto3
import requests
from requests_aws4auth import AWS4Auth

logger = logging.getLogger()
logger.setLevel(logging.INFO)

agent = boto3.client("bedrock-agent-runtime")
sts = boto3.client("sts")

GRAPHQL_URL = os.environ["GRAPHQL_URL"]
AGENT_ID = os.environ["AGENT_ID"]
AGENT_ALIAS_ID = os.environ["AGENT_ALIAS_ID"]
ACCESS_TENANT_DATA_ROLE_ARN = os.environ["ACCESS_TENANT_DATA_ROLE_ARN"]


def handler(event, context):
    logger.info(json.dumps(event))

    answer_id = event["detail"]["arguments"]["answerId"]

    if AGENT_ID == "AGENT_ID" or AGENT_ALIAS_ID == "AGENT_ALIAS_ID":
        update_answer(
            answer_id,
            "DONE",
            "Please set AGENT_ID and AGENT_ALIAS_ID in the invokeAgent Lambda function",
        )

        return {"id": answer_id}

    prompt = event["detail"]["arguments"]["prompt"]
    tenant_id = event["detail"]["identity"]["claims"]["custom:tenantId"]
    user_id = event["detail"]["identity"]["claims"]["sub"]

    credentials = generate_tenant_credentials(tenant_id)

    response = agent.invoke_agent(
        agentId=AGENT_ID,
        agentAliasId=AGENT_ALIAS_ID,
        enableTrace=True,
        inputText=prompt,
        sessionId=answer_id,
        sessionState={
            "sessionAttributes": {
                "tenantId": tenant_id,
                "userId": user_id,
                "accessKeyId": credentials["accessKeyId"],
                "secretAccessKey": credentials["secretAccessKey"],
                "sessionToken": credentials["sessionToken"],
            },
        },
    )

    for chunk in response["completion"]:
        logging.info(chunk)

        if "chunk" in chunk:
            update_answer(
                answer_id,
                "",
                chunk["chunk"]["bytes"].decode("utf-8"),
            )

    update_answer(
        answer_id,
        "DONE",
        "",
    )

    return {"id": answer_id}


def generate_tenant_credentials(tenant_id: str):
    response = sts.assume_role(
        RoleArn=ACCESS_TENANT_DATA_ROLE_ARN,
        RoleSessionName="agentTaskLambda",
        Tags=[{"Key": "TenantId", "Value": tenant_id}],
        DurationSeconds=900,
    )
    return {
        "accessKeyId": response["Credentials"]["AccessKeyId"],
        "secretAccessKey": response["Credentials"]["SecretAccessKey"],
        "sessionToken": response["Credentials"]["SessionToken"],
    }


def update_answer(answer_id: str, status: str, answer_chunk: str):
    answer_chunk = (
        answer_chunk.encode("unicode_escape").decode("utf-8").replace('"', '\\"')
    )  # deal with new lines and quotes
    query = """
    mutation answerChunk {
        newAnswerChunk (answerStatus: \"$answerStatus\", answerId: \"$answerId\", answerChunk: \"$answerChunk\")
        {
            answerId
            answerStatus
            answerChunk
        }
    }
    """

    query = query.replace("$answerId", answer_id)
    query = query.replace("$answerStatus", status)
    query = query.replace("$answerChunk", answer_chunk)

    request = {"query": query}

    aws_region = boto3.Session().region_name
    credentials = boto3.Session().get_credentials()

    auth = AWS4Auth(
        credentials.access_key,
        credentials.secret_key,
        aws_region,
        "appsync",
        session_token=credentials.token,
    )

    logging.info(request)
    response = requests.post(
        json=request,
        url=GRAPHQL_URL,
        headers={"Content-Type": "application/json"},
        auth=auth,
        timeout=10,
    )

    logging.info(response.json())

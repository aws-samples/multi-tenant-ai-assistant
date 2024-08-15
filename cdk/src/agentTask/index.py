import json
import logging
import os

import boto3
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    dynamodb = boto3.resource(
        "dynamodb",
        aws_access_key_id=event["sessionAttributes"]["accessKeyId"],
        aws_secret_access_key=event["sessionAttributes"]["secretAccessKey"],
        aws_session_token=event["sessionAttributes"]["sessionToken"],
    )

    tenant_config_table_name = os.getenv("TENANT_CONFIG_TABLE_NAME")
    tenant_config_table = dynamodb.Table(tenant_config_table_name)

    tenant_id = event["sessionAttributes"]["tenantId"]
    user_id = event["sessionAttributes"]["userId"]

    if event["apiPath"] == "/policies":
        response = get_policies(tenant_config_table, tenant_id)
    elif event["apiPath"] == "/orders":
        orders_table_name = get_orders_table_name(tenant_config_table, tenant_id)
        orders_table = dynamodb.Table(orders_table_name)
        response = get_orders(orders_table, user_id)
    else:
        raise Exception("Not supported API path...")

    return {
        "messageVersion": "1.0",
        "response": {
            "actionGroup": event["actionGroup"],
            "apiPath": event["apiPath"],
            "httpMethod": "GET",
            "httpStatusCode": 200,
            "responseBody": {"application/json": {"body": json.dumps(response)}},
        },
    }


def get_policies(tenant_config_table, tenant_id):
    logger.info("Getting policies...")

    policies = tenant_config_table.query(
        KeyConditionExpression=Key("tenantId").eq(tenant_id)
    )["Items"][0]["policies"]
    logger.info(f"Policies: {policies}")
    returns_policies_text = (
        f"You can return items up to {policies['returns']['days']} days"
    )
    return {"policies": {"returns": returns_policies_text}}


def get_orders_table_name(tenant_config_table, tenant_id):
    return tenant_config_table.query(
        KeyConditionExpression=Key("tenantId").eq(tenant_id)
    )["Items"][0]["ordersTableName"]


def get_orders(orders_table, user_id):
    logger.info("Getting orders...")

    orders = orders_table.query(KeyConditionExpression=Key("userId").eq(user_id))[
        "Items"
    ]
    logger.info(f"Orders: {orders}")
    return {"orders": orders}

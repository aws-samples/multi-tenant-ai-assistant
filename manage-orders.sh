#!/bin/bash
set -exo pipefail

while [[ $# -ne 2 ]]; do
    echo "Please specify username and command"
    exit 1
done


username=$1
command=$2

config_table_name=$(aws cloudformation describe-stacks --region us-east-1 --stack-name MultiTenantAiAssistantStack --query 'Stacks[0].Outputs[?OutputKey==`tenantConfigurationTableName`].OutputValue' --output text)
user_pool_id=$(aws cloudformation describe-stacks --region us-east-1 --stack-name MultiTenantAiAssistantStack --query 'Stacks[0].Outputs[?OutputKey==`userPoolId`].OutputValue' --output text)

user_id=$(aws cognito-idp admin-get-user --region us-east-1 --username $username --user-pool-id $user_pool_id --query 'UserAttributes[?Name==`sub`].Value' --output text)
tenant_id=$(aws cognito-idp admin-get-user --region us-east-1 --username $username --user-pool-id $user_pool_id --query 'UserAttributes[?Name==`custom:tenantId`].Value' --output text)
order_table_name=$(aws dynamodb get-item --region us-east-1 --table-name $config_table_name --key '{ "tenantId": {"S": "tenant1"} }' --query 'Item.ordersTableName.S' --output text)


if [[ $command == "add" ]]; then
    amount=$((1 + $RANDOM % 10))
    order_id=$((1 + $RANDOM % 100))
    order_date=$(date +"%Y-%m-%dT%H:%M:%S%z")
    echo "Adding order with amount $amount, ID $order_id, date $order_date for user $username"

    aws dynamodb put-item --region us-east-1 --table-name $order_table_name --item "{\"userId\": {\"S\": \"$user_id\"}, \"orderId\": {\"S\": \"$order_id\"}, \"orderDate\": {\"S\": \"$order_date\"}, \"total\": {\"S\": \"$amount\"}}"

fi

if [[ $command == "clear" ]]; then
    order_ids=$(aws dynamodb query --table-name $order_table_name --region us-east-1 --key-condition-expression "userId = :userId" --expression-attribute-values '{":userId":{"S":"'$user_id'"}}' --query 'Items[*].orderId.S' --output text)
    for id in $order_ids; do
        aws dynamodb delete-item --region us-east-1 --table-name $order_table_name --key "{\"userId\": {\"S\": \"$user_id\"}, \"orderId\": {\"S\": \"$id\"}}"
    done
    
fi
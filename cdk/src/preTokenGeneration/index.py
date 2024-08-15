import json


def handler(event, context):
    print(json.dumps(event))
    event['response']['claimsAndScopeOverrideDetails'] = {
        'accessTokenGeneration': {
            'claimsToAddOrOverride': {
                'custom:tenantId': event['request']['userAttributes']['custom:tenantId']
            }
        }
    }
    return event

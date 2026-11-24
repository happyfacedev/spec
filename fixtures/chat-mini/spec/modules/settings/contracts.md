# settings contracts

### settings.ApiKey
Kind: entity · Status: active
The credential used to call one provider.

#### settings.ApiKey.providerId
The provider this key belongs to. Type: providers.ProviderId

#### settings.ApiKey.secret
The secret value of the key. Type: string

### settings.MissingApiKey
Kind: error · Status: active
Enabling failed: the provider has no API key.

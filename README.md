# BitBucket Cloud CLI Auth

This project allows easy access token retrieval for BitBucket Cloud in CLI apps.

## Installation

### npm
```bash
npm i @soliantconsulting/bitbucket-cloud-cli-auth
```

### pnpm
```bash
pnpm add @soliantconsulting/bitbucket-cloud-cli-auth
```


## Usage

```typescript
import { getAccessToken } from "@soliantconsulting/bitbucket-cloud-cli-auth";

const accessToken = await getAccessToken(clientId, port);
```

# Dashboard Backend Team — API Integration Requirements Brief


## 1. API Key Generation & Management

### What the API Expects

The API authenticates every request using a Bearer token in the `Authorization` header:

```
Authorization: Bearer sk_live_xxxxxxxxxxxxxxxx
```

The authentication flow in the API works as follows:

1. Extract the key from `Bearer <key>`
2. Validate the prefix is either `sk_live_` (production) or `sk_test_` (sandbox)
3. Hash the key using **SHA-256**: `crypto.createHash("sha256").update(apiKey).digest("hex")`
4. Look up the hash in the `ApiKeys` table
5. Fetch the associated merchant and verify their status is `active`

### Database Schema — `ApiKeys` Table

| Column        | Type        | Description                                            |
|---------------|-------------|--------------------------------------------------------|
| `id`          | `integer`   | Auto-increment primary key                             |
| `merchant_id` | `string`    | FK → `Merchants.merchant_id` (CASCADE delete)          |
| `key_hash`    | `string`    | SHA-256 hash of the full API key (unique)              |
| `prefix`      | `string`    | Key prefix: `sk_live` or `sk_test`                     |
| `env`         | `string`    | Environment: `live` or `test`                          |
| `created_at`  | `timestamp` | Auto-set on creation                                   |
| `last_used`   | `timestamp` | Nullable, updated when the key is used (not yet impl.) |

### What the Dashboard Must Implement

#### Generate API Key
- Generate a cryptographically secure random key with the format: `sk_live_<random>` or `sk_test_<random>`
- **Display the raw key to the merchant exactly once** (it cannot be retrieved later)
- Hash the key with SHA-256 and store the hash in `ApiKeys.key_hash`
- Store the prefix (`sk_live` or `sk_test`) and env (`live` or `test`)
- Associate with the merchant's `merchant_id`

#### Key Management UI
- **List keys** — Show existing keys with: prefix, env, `created_at`, `last_used` (mask the actual key — it's not stored)
- **Revoke/delete keys** — Delete the row from `ApiKeys` (this immediately invalidates the key on the API side)
- **Regenerate key** — Delete old + generate new (warn the merchant that the old key stops working immediately)
- Support **both** live and test keys (the API treats both as valid but they should map to separate environments)

> [!IMPORTANT]
> The raw API key is **never stored** — only the SHA-256 hash. The key can only be shown at generation time. Make this very clear in the UI.

> [!CAUTION]
> Revoking or regenerating a key **immediately breaks** any integration using that key. The dashboard should display a confirmation dialog warning the merchant.

---

## 2. Webhook URL & Secret Configuration

### What the API Expects

When events occur (e.g., points credited, points redeemed), the API sends webhook notifications to the merchant's configured URL. The webhook service reads these two fields from the `Merchants` table:

| Column           | Type     | Description                                       |
|------------------|----------|---------------------------------------------------|
| `webhook_url`    | `string` | The HTTPS endpoint to POST webhook events to      |
| `webhook_secret` | `string` | Shared secret used to sign payloads with HMAC-SHA256 |

If either field is `null`, **no webhooks are sent**.

### Webhook Delivery Details (for documentation purposes)

The API sends webhooks with:
- **Method:** `POST`
- **Timeout:** 5 seconds
- **Retries:** 3 attempts with exponential backoff (1s, 2s, 4s)
- **Headers:**
  - `Content-Type: application/json`
  - `X-Rewrd-Signature: t=<unix_timestamp>,v1=<hmac_signature>`
  - `User-Agent: Rewrd-Webhook/1.0`

**Signature format:** `HMAC-SHA256(timestamp + "." + JSON.stringify(payload), webhook_secret)`

**Payload structure:**
```json
{
  "id": "uuid-v4",
  "event": "points.earned",
  "created_at": "2026-03-03T12:00:00.000Z",
  "data": { ... }
}
```

### What the Dashboard Must Implement

#### Webhook URL Setting
- Input field for the merchant to enter their **webhook URL**
- **Validate** it's a properly formatted HTTPS URL
- Store in `Merchants.webhook_url`
- Allow clearing the URL (set to `null` to disable webhooks)

#### Webhook Secret Generation
- **Auto-generate** a webhook secret when the merchant first sets a webhook URL
- Format: `whsec_<random_secure_string>` (e.g., `whsec_abc123def456...`)
- Store in `Merchants.webhook_secret`
- **Display the secret to the merchant** so they can use it to verify incoming webhook signatures on their end
- Allow **regenerating** the secret (warn that this invalidates the old signature verification)

#### Webhook Testing (Nice-to-Have)
- A "Send Test Webhook" button that sends a test event to the configured URL
- Helps merchants verify their endpoint is working before going live

#### Webhook Documentation Section
- Show the merchant:
  - The signature header format (`X-Rewrd-Signature: t=...,v1=...`)
  - How to verify: `HMAC-SHA256(timestamp + "." + rawBody, webhookSecret)`
  - List of available events (e.g., `points.earned`, `points.redeemed`, `customer.created`)
  - Example payload

---

## 3. IP Whitelisting

### What the API Expects

The `Merchants` table has an `ip_whitelist` column:

| Column         | Type   | Default | Description                                       |
|----------------|--------|---------|---------------------------------------------------|
| `ip_whitelist` | `jsonb`| `[]`    | Array of allowed IP addresses. Empty = allow all.  |

When the list is **non-empty**, the API only accepts requests from those IPs.

### What the Dashboard Must Implement

- UI to **view, add, and remove** IP addresses from the whitelist
- **Validate** that entries are valid IPv4 or IPv6 addresses
- Store as a JSON array in `Merchants.ip_whitelist`
- Sending an empty array `[]` disables IP whitelisting

> [!WARNING]
> Warn merchants that setting an incorrect whitelist can lock them out of their API. Consider a confirmation step.


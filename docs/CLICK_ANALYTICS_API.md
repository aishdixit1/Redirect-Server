# Click Analytics API Documentation

Welcome to the API documentation for the **WhatsApp Redirect Server Click Analytics** endpoints. This documentation details the endpoints used to retrieve click statistics and attribution data for broadcasts and contacts.

---

## 1. Overview & Base URL

* **Base URL:** `http://localhost:3000` (or your deployed server domain)
* **Format:** JSON
* **Content-Type:** `application/json`

---

## 2. Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/clicks/broadcast/:broadcast_id` | Fetch total clicks and list of contacts who clicked a specific broadcast |
| `GET` | `/api/clicks/contact/:contact_id` | Fetch total clicks and list of broadcasts clicked by a specific contact |

---

## 3. Endpoint Specifications

### 3.1 Get Broadcast Click Analytics

Retrieves aggregate click performance for a specific broadcast campaign, including the total number of link clicks and a distinct list of contacts who engaged with the message.

* **HTTP Method:** `GET`
* **URL Path:** `/api/clicks/broadcast/:broadcast_id`

#### Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `broadcast_id` | `String (UUID)` | **Yes** | The unique UUID identifier of the broadcast campaign. |

#### Headers

| Header | Value | Required |
| :--- | :--- | :--- |
| `Accept` | `application/json` | No |

---

#### Success Response (`200 OK`)

```json
{
  "total_clicks": 12,
  "contacts": [
    {
      "contact_id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Jane Doe",
      "phone_number": "+1234567890"
    },
    {
      "contact_id": "987f6543-e21b-34d1-b654-426614174999",
      "name": "John Smith",
      "phone_number": "+1987654321"
    }
  ]
}
```

##### Response Body Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `total_clicks` | `Integer` | Total click occurrences recorded for this broadcast. |
| `contacts` | `Array<Object>` | List of unique contacts who clicked the broadcast link. |
| `contacts[].contact_id` | `String (UUID)` | Unique contact identifier. |
| `contacts[].name` | `String` | Full name of the contact (concatenated `first_name` and `last_name`). |
| `contacts[].phone_number` | `String` | Mobile/WhatsApp phone number of the contact. |

---

#### Error Responses

##### `400 Bad Request` — Invalid UUID Format
Returned if the `broadcast_id` path parameter is missing or not a valid UUID format.

```json
{
  "error": "Invalid broadcast_id format. Must be a valid UUID."
}
```

##### `404 Not Found` — Broadcast Does Not Exist
Returned if no broadcast record exists with the provided `broadcast_id`.

```json
{
  "error": "Broadcast not found."
}
```

##### `500 Internal Server Error` — Database Error
Returned if an unexpected error occurs on the server or database query.

```json
{
  "error": "Internal server error while fetching broadcast click analytics."
}
```

---

#### Request Examples

##### cURL
```bash
curl -X GET "http://localhost:3000/api/clicks/broadcast/123e4567-e89b-12d3-a456-426614174000" \
     -H "Accept: application/json"
```

##### JavaScript (`fetch`)
```javascript
const broadcastId = '123e4567-e89b-12d3-a456-426614174000';
const response = await fetch(`http://localhost:3000/api/clicks/broadcast/${broadcastId}`);

if (!response.ok) {
  const errorData = await response.json();
  console.error('API Error:', errorData);
} else {
  const data = await response.json();
  console.log(`Total Clicks: ${data.total_clicks}`);
  console.log('Contacts:', data.contacts);
}
```

---

### 3.2 Get Contact Click Analytics

Retrieves link interaction stats for a single contact across all broadcasts, including their total click count and the list of broadcast campaigns they responded to.

* **HTTP Method:** `GET`
* **URL Path:** `/api/clicks/contact/:contact_id`

#### Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `contact_id` | `String (UUID)` | **Yes** | The unique UUID identifier of the contact. |

#### Headers

| Header | Value | Required |
| :--- | :--- | :--- |
| `Accept` | `application/json` | No |

---

#### Success Response (`200 OK`)

```json
{
  "total_clicks": 5,
  "broadcasts": [
    {
      "broadcast_id": "987f6543-e21b-34d1-b654-426614174999",
      "broadcast_name": "Diwali Special Discount Campaign"
    },
    {
      "broadcast_id": "550e8400-e29b-41d4-a716-446655440000",
      "broadcast_name": "New Collection Launch"
    }
  ]
}
```

##### Response Body Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `total_clicks` | `Integer` | Total click occurrences recorded for this contact across all campaigns. |
| `broadcasts` | `Array<Object>` | List of unique broadcast campaigns from which this contact clicked a link. |
| `broadcasts[].broadcast_id` | `String (UUID)` | Unique broadcast identifier. |
| `broadcasts[].broadcast_name` | `String` | Name of the broadcast campaign. |

---

#### Error Responses

##### `400 Bad Request` — Invalid UUID Format
Returned if the `contact_id` path parameter is missing or not a valid UUID format.

```json
{
  "error": "Invalid contact_id format. Must be a valid UUID."
}
```

##### `404 Not Found` — Contact Does Not Exist
Returned if no contact record exists with the provided `contact_id`.

```json
{
  "error": "Contact not found."
}
```

##### `500 Internal Server Error` — Database Error
Returned if an unexpected error occurs on the server or database query.

```json
{
  "error": "Internal server error while fetching contact click analytics."
}
```

---

#### Request Examples

##### cURL
```bash
curl -X GET "http://localhost:3000/api/clicks/contact/987f6543-e21b-34d1-b654-426614174999" \
     -H "Accept: application/json"
```

##### JavaScript (`fetch`)
```javascript
const contactId = '987f6543-e21b-34d1-b654-426614174999';
const response = await fetch(`http://localhost:3000/api/clicks/contact/${contactId}`);

if (!response.ok) {
  const errorData = await response.json();
  console.error('API Error:', errorData);
} else {
  const data = await response.json();
  console.log(`Total Clicks: ${data.total_clicks}`);
  console.log('Broadcasts:', data.broadcasts);
}
```

---

## 4. Status Codes Summary

| HTTP Status Code | Reason |
| :--- | :--- |
| `200 OK` | Request succeeded. Response body contains requested analytics data. |
| `400 Bad Request` | Provided path parameter is not a valid UUID. |
| `404 Not Found` | The requested broadcast or contact ID was not found in the database. |
| `500 Internal Server Error` | Database connection error or unhandled query failure. |

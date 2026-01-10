# API Documentation

Round Table web application API reference.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, no authentication is required. In production, you should implement proper authentication.

## Endpoints

### 1. Create Round Table

**POST** `/roundtable`

Create a new round table with agents.

#### Request Body

```json
{
  "topic": "string (required)",
  "agentCount": "number (2-6, required)",
  "maxRounds": "number (1-50, optional, default: 5)",
  "customPersonas": "Array<AgentPersona> (optional)"
}
```

#### Example

```bash
curl -X POST http://localhost:3000/api/roundtable \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Should AI have rights?",
    "agentCount": 3
  }'
```

#### Response (201 Created)

```json
{
  "roundTable": {
    "id": "cmjpre7pg000010ud61tgbi5s",
    "topic": "Should AI have rights?",
    "agentCount": 3,
    "maxRounds": 5,
    "status": "active",
    "createdAt": "2025-12-28T13:22:21.713Z",
    "agents": [
      {
        "id": "agent-1",
        "name": "Devil's Advocate",
        "persona": "You are the Devil's Advocate...",
        "order": 1
      }
    ]
  }
}
```

---

### 2. List Round Tables

**GET** `/roundtable`

Get all round tables, optionally filtered by status.

#### Query Parameters

- `status` (optional): Filter by status (`active`, `paused`, `archived`)
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 10)

#### Example

```bash
curl http://localhost:3000/api/roundtable?status=active
```

#### Response (200 OK)

```json
{
  "roundTables": [
    {
      "id": "cmjpre7pg000010ud61tgbi5s",
      "topic": "Should AI have rights?",
      "agentCount": 3,
      "maxRounds": 5,
      "status": "active",
      "createdAt": "2025-12-28T13:22:21.713Z",
      "updatedAt": "2025-12-28T13:22:21.713Z",
      "roundCount": 1,
      "agents": [...]
    }
  ],
  "total": 1
}
```

---

### 3. Get Round Table

**GET** `/roundtable/{id}`

Get a specific round table with all details.

#### Example

```bash
curl http://localhost:3000/api/roundtable/cmjpre7pg000010ud61tgbi5s
```

#### Response (200 OK)

```json
{
  "roundTable": {
    "id": "cmjpre7pg000010ud61tgbi5s",
    "topic": "Should AI have rights?",
    "agentCount": 3,
    "maxRounds": 5,
    "status": "active",
    "createdAt": "2025-12-28T13:22:21.713Z",
    "updatedAt": "2025-12-28T13:22:21.713Z",
    "agents": [...],
    "rounds": [
      {
        "id": "round-1",
        "roundNumber": 1,
        "status": "completed",
        "createdAt": "2025-12-28T13:22:21.713Z",
        "completedAt": "2025-12-28T13:25:00.000Z",
        "messageCount": 3
      }
    ]
  }
}
```

---

### 4. Update Status

**PATCH** `/roundtable/{id}`

Update the status of a round table.

#### Request Body

```json
{
  "status": "active|paused|archived"
}
```

#### Example

```bash
curl -X PATCH http://localhost:3000/api/roundtable/cmjpre7pg000010ud61tgbi5s \
  -H "Content-Type: application/json" \
  -d '{"status": "paused"}'
```

#### Response (200 OK)

```json
{
  "roundTable": {
    "id": "cmjpre7pg000010ud61tgbi5s",
    "topic": "Should AI have rights?",
    "agentCount": 3,
    "status": "paused",
    ...
  }
}
```

---

### 5. Delete Round Table

**DELETE** `/roundtable/{id}`

Delete a round table and all associated data (cascade delete).

#### Example

```bash
curl -X DELETE http://localhost:3000/api/roundtable/cmjpre7pg000010ud61tgbi5s
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Round table deleted"
}
```

---

### 6. Start Round (SSE)

**POST** `/roundtable/{id}/round`

Start a new discussion round with Server-Sent Events streaming.

#### Stream Events

The endpoint streams events in real-time:

- `round-start` - Round has started
- `agent-start` - Agent begins speaking
- `chunk` - Text chunk from agent (streamed)
- `tool-call` - Agent used web search tool
- `message-saved` - Message saved to database
- `agent-complete` - Agent finished speaking
- `round-complete` - All agents finished
- `done` - Stream complete
- `error` - Error occurred

#### Example (curl)

```bash
curl -N http://localhost:3000/api/roundtable/cmjpre7pg000010ud61tgbi5s/round \
  -H "Accept: text/event-stream"
```

#### Example (JavaScript)

```javascript
const eventSource = new EventSource(
  'http://localhost:3000/api/roundtable/cmjpre7pg000010ud61tgbi5s/round'
);

eventSource.addEventListener('round-start', (event) => {
  const data = JSON.parse(event.data);
  console.log('Round started:', data.roundNumber);
});

eventSource.addEventListener('chunk', (event) => {
  const data = JSON.parse(event.data);
  console.log(`${data.agentName}: ${data.chunk}`);
});

eventSource.addEventListener('agent-complete', (event) => {
  const data = JSON.parse(event.data);
  console.log(`${data.agentName} finished`);
});

eventSource.addEventListener('round-complete', (event) => {
  const data = JSON.parse(event.data);
  console.log('Round complete');
  eventSource.close();
});

eventSource.addEventListener('error', (event) => {
  console.error('Stream error:', event);
  eventSource.close();
});
```

#### Stream Event Examples

```javascript
// round-start
{
  "roundId": "cmjpre7po000510udngrk4k34",
  "roundNumber": 1,
  "agentCount": 3
}

// agent-start
{
  "agentId": "agent-1",
  "agentName": "Devil's Advocate",
  "timestamp": "2025-12-28T13:22:21.713Z"
}

// chunk
{
  "agentId": "agent-1",
  "agentName": "Devil's Advocate",
  "chunk": "I believe we need to carefully consider...",
  "timestamp": "2025-12-28T13:22:22.000Z"
}

// tool-call
{
  "agentId": "agent-1",
  "agentName": "Devil's Advocate",
  "toolCall": {
    "type": "web_search",
    "query": "AI ethics and rights 2024",
    "timestamp": "2025-12-28T13:22:25.000Z"
  }
}

// agent-complete
{
  "agentId": "agent-1",
  "agentName": "Devil's Advocate",
  "timestamp": "2025-12-28T13:22:30.000Z"
}

// round-complete
{
  "roundId": "cmjpre7po000510udngrk4k34",
  "roundNumber": 1,
  "timestamp": "2025-12-28T13:25:00.000Z"
}
```

## Error Responses

All endpoints may return error responses:

#### 400 Bad Request

```json
{
  "error": "Error message",
  "details": "Detailed error description"
}
```

#### 404 Not Found

```json
{
  "error": "Resource not found"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Internal server error",
  "details": "Error details"
}
```

#### 400 Bad Request (Max Rounds Reached)

```json
{
  "error": "Maximum rounds reached (5 of 5)"
}
```

## Testing

Run the API test suite:

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run API tests
npm run test:api
```

## Rate Limiting

Currently not implemented. Add rate limiting for production use.

## CORS

Configure CORS in production to restrict access to trusted origins.

## Next Steps

- Add authentication
- Implement rate limiting
- Add request validation middleware
- Add API versioning
- Implement pagination
- Add filtering and sorting options

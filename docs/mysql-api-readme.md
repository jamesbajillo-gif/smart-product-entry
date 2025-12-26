# General-Purpose MySQL CRUD API

A comprehensive PHP RESTful API for MySQL database operations. Works with **any MySQL database** - credentials can be provided per request, via environment variables, or using default configuration.

## Features

- ✅ **Flexible Database Configuration** - Use different databases per request
- ✅ **Full CRUD Operations** - Create, Read, Update, Delete
- ✅ **Advanced Filtering** - Support for LIKE, IN, comparison operators (>, <, >=, <=)
- ✅ **Bulk Operations** - Insert/Update/Delete multiple records at once
- ✅ **Custom Primary Keys** - Works with any primary key column, not just 'id'
- ✅ **Database Management** - List databases, tables, describe table structure
- ✅ **Custom Queries** - Execute SELECT queries safely
- ✅ **Pagination** - Built-in support for limit/offset
- ✅ **Connection Caching** - Efficient connection reuse

## Database Configuration

The API supports multiple ways to configure database connections:

### 1. Default Configuration (config.php)
Default values are set in `config.php`. These are used when no other configuration is provided.

### 2. Environment Variables (Recommended for Production)
Set these environment variables:
```bash
export DB_HOST=your-host
export DB_NAME=your-database
export DB_USER=your-username
export DB_PASS=your-password
export DB_PORT=3306
export DB_CHARSET=utf8mb4
```

### 3. Per-Request Configuration
Provide database credentials in each request:

**Via Query Parameters:**
```
?db_host=host&db_database=dbname&db_user=user&db_password=pass
```

**Via JSON Body:**
```json
{
  "db_config": {
    "host": "host",
    "database": "dbname",
    "user": "username",
    "password": "password",
    "port": 3306
  },
  "table": "users"
}
```

## API Endpoints

All endpoints use the base URL: `mysql/api.php`

### Special Operations (No Table Required)

#### 1. List Databases
**GET** `mysql/api.php?action=databases`

**Response:**
```json
{
  "success": true,
  "data": ["database1", "database2", "database3"],
  "count": 3
}
```

#### 2. List Tables
**GET** `mysql/api.php?action=tables`
**GET** `mysql/api.php?action=tables&database=dbname`

**Response:**
```json
{
  "success": true,
  "data": ["users", "products", "orders"],
  "count": 3,
  "database": "current"
}
```

#### 3. Describe Table Structure
**GET** `mysql/api.php?action=describe&table=users`

**Response:**
```json
{
  "success": true,
  "table": "users",
  "columns": [
    {
      "Field": "id",
      "Type": "int(11)",
      "Null": "NO",
      "Key": "PRI",
      "Default": null,
      "Extra": "auto_increment"
    }
  ],
  "primary_keys": ["id"],
  "column_count": 5
}
```

#### 4. Execute Custom SELECT Query
**POST** `mysql/api.php?action=query`

**Request Body:**
```json
{
  "query": "SELECT * FROM users WHERE status = 'active' LIMIT 10"
}
```

**Note:** Only SELECT queries are allowed for security reasons.

#### 5. Database Information
**GET** `mysql/api.php?action=info`

**Response:**
```json
{
  "success": true,
  "database": "mytchstore",
  "version": "8.0.33",
  "driver": "mysql"
}
```

### CRUD Operations

#### 1. SEARCH (GET) - Retrieve Records

**URL**: `mysql/api.php?table=table_name`

**Query Parameters**:
- `table` (required): Table name
- `id` (optional): Get specific record by ID
- `primary_key` (optional): Specify primary key column (default: auto-detected or 'id')
- `limit` (optional): Limit results (default: 100)
- `offset` (optional): Offset for pagination (default: 0)
- `order_by` (optional): Column to order by
- `order_dir` (optional): ASC or DESC (default: ASC)
- `fields` (optional): Comma-separated list of fields to return (default: *)
- Any column name: Filter by column value (exact match)

**Advanced Filtering Operators:**
- `column__gt`: Greater than
- `column__gte`: Greater than or equal
- `column__lt`: Less than
- `column__lte`: Less than or equal
- `column__like`: LIKE pattern match
- `column__in`: IN clause (comma-separated or array)
- `column__not`: Not equal

**Examples**:
```
GET mysql/api.php?table=users
GET mysql/api.php?table=users&id=1
GET mysql/api.php?table=users&status=active&limit=10
GET mysql/api.php?table=products&price__gt=100&price__lt=500
GET mysql/api.php?table=users&name__like=john
GET mysql/api.php?table=users&status__in=active,pending
GET mysql/api.php?table=users&fields=id,name,email
```

**Using JSON Filters:**
```json
{
  "table": "users",
  "filters": [
    {"column": "age", "operator": ">", "value": 18},
    {"column": "name", "operator": "like", "value": "john"},
    {"column": "status", "operator": "in", "value": ["active", "pending"]}
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": [...],
  "total": 50,
  "limit": 100,
  "offset": 0,
  "primary_key": "id"
}
```

#### 2. ADD (POST) - Create New Record(s)

**URL**: `mysql/api.php`

**Single Insert:**
```json
{
  "table": "users",
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "status": "active"
  }
}
```

**Bulk Insert:**
```json
{
  "table": "users",
  "data": [
    {"name": "John Doe", "email": "john@example.com"},
    {"name": "Jane Doe", "email": "jane@example.com"}
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Record added successfully",
  "id": 123
}
```

**Bulk Insert Response:**
```json
{
  "success": true,
  "message": "Bulk insert successful: 2 record(s) added",
  "affected_rows": 2,
  "first_id": 123
}
```

#### 3. UPDATE (PUT/PATCH) - Update Existing Record(s)

**URL**: `mysql/api.php`

**Single Update:**
```json
{
  "table": "users",
  "id": 123,
  "primary_key": "user_id",
  "data": {
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
}
```

**Bulk Update:**
```json
{
  "table": "users",
  "ids": [1, 2, 3],
  "primary_key": "id",
  "data": {
    "status": "inactive"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Record updated successfully",
  "affected_rows": 1
}
```

#### 4. DELETE - Delete Record(s)

**URL**: `mysql/api.php`

**Single Delete:**
```json
{
  "table": "users",
  "id": 123
}
```

**OR via GET:**
```
DELETE mysql/api.php?table=users&id=123
```

**Bulk Delete:**
```json
{
  "table": "users",
  "ids": [1, 2, 3],
  "primary_key": "id"
}
```

**OR via GET:**
```
DELETE mysql/api.php?table=users&ids=1,2,3
```

**Response**:
```json
{
  "success": true,
  "message": "Record deleted successfully",
  "affected_rows": 1
}
```

## Usage Examples

### Using cURL

**List Databases:**
```bash
curl "http://your-domain/mysql/api.php?action=databases"
```

**Search with Different Database:**
```bash
curl "http://your-domain/mysql/api.php?table=users&db_host=other-host&db_database=other-db&db_user=user&db_password=pass"
```

**Advanced Search:**
```bash
curl "http://your-domain/mysql/api.php?table=products&price__gt=100&price__lt=500&category__in=electronics,computers"
```

**Add Record:**
```bash
curl -X POST http://your-domain/mysql/api.php \
  -H "Content-Type: application/json" \
  -d '{
    "table": "users",
    "data": {
      "name": "John",
      "email": "john@example.com"
    }
  }'
```

**Bulk Insert:**
```bash
curl -X POST http://your-domain/mysql/api.php \
  -H "Content-Type: application/json" \
  -d '{
    "table": "users",
    "data": [
      {"name": "John", "email": "john@example.com"},
      {"name": "Jane", "email": "jane@example.com"}
    ]
  }'
```

**Update:**
```bash
curl -X PUT http://your-domain/mysql/api.php \
  -H "Content-Type: application/json" \
  -d '{
    "table": "users",
    "id": 1,
    "data": {"name": "Jane"}
  }'
```

**Delete:**
```bash
curl -X DELETE http://your-domain/mysql/api.php \
  -H "Content-Type: application/json" \
  -d '{"table": "users", "id": 1}'
```

### Using JavaScript (Fetch API)

```javascript
// List databases
fetch('mysql/api.php?action=databases')
  .then(res => res.json())
  .then(data => console.log(data));

// Search with advanced filtering
fetch('mysql/api.php?table=users&age__gt=18&status__in=active,pending')
  .then(res => res.json())
  .then(data => console.log(data));

// Search with JSON filters
fetch('mysql/api.php?table=users', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    table: 'users',
    filters: [
      {column: 'age', operator: '>', value: 18},
      {column: 'name', operator: 'like', value: 'john'}
    ]
  })
})
  .then(res => res.json())
  .then(data => console.log(data));

// Add with custom database
fetch('mysql/api.php', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    db_config: {
      host: 'other-host',
      database: 'other-db',
      user: 'user',
      password: 'pass'
    },
    table: 'users',
    data: {name: 'John', email: 'john@example.com'}
  })
})
  .then(res => res.json())
  .then(data => console.log(data));

// Bulk insert
fetch('mysql/api.php', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    table: 'users',
    data: [
      {name: 'John', email: 'john@example.com'},
      {name: 'Jane', email: 'jane@example.com'}
    ]
  })
})
  .then(res => res.json())
  .then(data => console.log(data));

// Update with custom primary key
fetch('mysql/api.php', {
  method: 'PUT',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    table: 'users',
    id: 1,
    primary_key: 'user_id',
    data: {name: 'Jane'}
  })
})
  .then(res => res.json())
  .then(data => console.log(data));

// Bulk delete
fetch('mysql/api.php', {
  method: 'DELETE',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    table: 'users',
    ids: [1, 2, 3]
  })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

## Security Notes

⚠️ **Important**: This API is designed for general-purpose MySQL operations. For production use, consider:

1. **Authentication/Authorization** - Add API keys or OAuth tokens
2. **Input Validation** - Validate all inputs before processing
3. **Rate Limiting** - Prevent abuse and DDoS attacks
4. **SQL Injection Protection** - Already using prepared statements, but validate table/column names
5. **HTTPS Only** - Never send credentials over HTTP
6. **Table/Column Whitelisting** - Restrict which tables/columns can be accessed
7. **Environment Variables** - Use environment variables for sensitive credentials
8. **Connection Limits** - Monitor and limit database connections
9. **Query Timeouts** - Set maximum query execution time
10. **Audit Logging** - Log all database operations

## Requirements

- PHP 7.0+
- PDO MySQL extension
- MySQL/MariaDB server
- Apache with mod_rewrite (for .htaccess) or Nginx with appropriate configuration

## Configuration Priority

1. **Request Parameters** (highest priority) - Database config in request
2. **Environment Variables** - Set via `export` or `.env` file
3. **Default Config** (lowest priority) - Values in `config.php`

## Error Handling

All errors return JSON responses with:
- `success`: false
- `message`: Human-readable error message
- `error`: Technical error details (if available)

HTTP Status Codes:
- `200`: Success
- `400`: Bad Request (missing/invalid parameters)
- `404`: Not Found (record not found)
- `405`: Method Not Allowed
- `500`: Internal Server Error

## Performance Tips

1. Use connection caching (already implemented)
2. Use indexes on frequently queried columns
3. Use `fields` parameter to limit returned columns
4. Use `limit` to paginate large result sets
5. Use bulk operations for multiple records
6. Monitor query performance and optimize slow queries

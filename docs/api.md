# Mikyaj Kuwait Catalog API Documentation

## Base URL
`/api`

## Endpoints

### 1. Health
Check if the API and database are running.

**GET /api/health**
**Response:** `200 OK`
```json
{
  "status": "ok"
}
```

### 2. Categories
Retrieve all active categories.

**GET /api/categories**
**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name_ar": "...",
    "name_en": "Uncategorized",
    "slug": "uncategorized",
    "status": "ACTIVE"
  }
]
```

### 3. Brands
Retrieve all active brands.

**GET /api/brands**
**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Al Attar",
    "slug": "al-attar",
    "status": "ACTIVE"
  }
]
```

### 4. Products Listing
Retrieve a paginated list of active products with optional filters.

**GET /api/products**

**Query Parameters:**
- `limit` (integer): Number of products to return (default: 24, max: 60).
- `cursor` (string): Opaque string for fetching the next page.
- `search` (string): Search text against name_ar, name_en, and sku.
- `category` (string): Filter by category slug.
- `brand` (string): Filter by brand slug.
- `min_price` (float): Minimum selling price.
- `max_price` (float): Maximum selling price.

**Response:** `200 OK`
```json
{
  "products": [
    {
      "id": 1,
      "sku": "5933",
      "slug": "al-attar-hair-cream",
      "name_ar": "كريم الشعر العطار",
      "name_en": "Al Attar Hair Cream",
      "selling_price": "1.496",
      "regular_price": "2.000",
      "currency": "KWD",
      "category": {
        "id": 1,
        "name_ar": "...",
        "name_en": "Uncategorized",
        "slug": "uncategorized"
      },
      "brand": null,
      "primary_image": {
        "url": "https://res.cloudinary.com/...",
        "width": 1200,
        "height": 1488
      }
    }
  ],
  "next_cursor": "Mw=="
}
```

### 5. Product Detail
Retrieve full product details including all images.

**GET /api/products/:slug**

**Response:** `200 OK`
```json
{
  "product": {
    "id": 1,
    "sku": "5933",
    "slug": "al-attar-hair-cream",
    "name_ar": "كريم الشعر العطار",
    "name_en": "Al Attar Hair Cream",
    "short_description_ar": "...",
    "short_description_en": "...",
    "details_ar": "...",
    "details_en": "...",
    "source_price": "1.500",
    "regular_price": "2.000",
    "selling_price": "1.496",
    "currency": "KWD",
    "category": {
      "id": 1,
      "name_ar": "...",
      "name_en": "Uncategorized",
      "slug": "uncategorized"
    },
    "brand": null,
    "images": [
      {
        "url": "https://res.cloudinary.com/...",
        "order": 1,
        "width": 1200,
        "height": 1488
      }
    ]
  }
}
```

## Error Handling
- **400 Bad Request**: Invalid query parameters (e.g., negative limit, invalid cursor string).
- **404 Not Found**: For `/api/products/:slug` when the product slug does not exist.
- **500 Internal Server Error**: Unexpected database or server errors.
- **503 Service Unavailable**: For `/api/health` if the database is down.

---

## Admin APIs (Order Management)

*Authentication is required for all these endpoints using a JWT Bearer token in the `Authorization` header.*

### AUTHENTICATION
**POST /api/admin/auth/login**
- **Body**: `{ "email": "...", "password": "..." }`
- **Response**: `200 OK` with `{ "token": "...", "admin": { "id": 1, "email": "...", "role": "ADMIN" } }`

### ORDER LIST
**GET /api/admin/orders**
- **Query Parameters**: `status`, `payment_status`, `search`, `date_from`, `date_to`, `min_total`, `max_total`, `limit`, `cursor`.
- **Response**: `200 OK` with paginated list of orders and `next_cursor`.

### ORDER DETAIL
**GET /api/admin/orders/:orderNumber**
- **Response**: `200 OK` with complete details including `order`, `items` (with historical `price_at_purchase`), and `payment`.

### STATUS UPDATE
**PATCH /api/admin/orders/:orderNumber/status**
- **Body**: `{ "status": "CONFIRMED", "reason": "Optional reason" }`
- **Response**: `200 OK` with updated status. Transactional, concurrency-protected.

### CANCELLATION
**POST /api/admin/orders/:orderNumber/cancel**
- **Body**: `{ "reason": "Customer requested cancellation" }` (Reason is mandatory).
- **Response**: `200 OK` on successful cancellation.

### ORDER HISTORY
**GET /api/admin/orders/:orderNumber/history**
- **Response**: `200 OK` with chronological list of status transitions.

### PAYMENTS
**GET /api/admin/orders/:orderNumber/payments**
- **Response**: `200 OK` with history of MyFatoorah payment attempts and outcomes.


## Driver & Delivery Management (Phase 6A)

### Driver Auth
- POST /api/driver/auth/login: Driver login (returns JWT).

### Admin Driver Management
- POST /api/admin/drivers: Create driver.
- GET /api/admin/drivers: List all drivers.
- PATCH /api/admin/drivers/:driverId/status: Update driver status (ACTIVE/INACTIVE).

### Admin Driver Assignment
- POST /api/admin/orders/:orderNumber/assign-driver: Assign an order to a driver. Order must be READY_FOR_DELIVERY.
- POST /api/admin/orders/:orderNumber/unassign-driver: Unassign a driver from an order.

### Driver Delivery Operations
- GET /api/driver/orders: List currently assigned active orders for the authenticated driver.
- GET /api/driver/orders/:orderNumber: Get details of a specific assigned order.
- POST /api/driver/orders/:orderNumber/start-delivery: Start delivery (READY_FOR_DELIVERY -> OUT_FOR_DELIVERY).
- POST /api/driver/orders/:orderNumber/mark-delivered: Complete delivery (OUT_FOR_DELIVERY -> DELIVERED).
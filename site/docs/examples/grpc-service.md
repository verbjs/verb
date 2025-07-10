# gRPC Service Example

Complete example of building a gRPC microservice with Verb, including Protocol Buffers, streaming, authentication, and client implementation.

## Overview

This example demonstrates building a full-featured gRPC service for a product catalog system with:

- Protocol Buffer service definitions
- Unary, server streaming, client streaming, and bidirectional streaming RPCs
- Authentication and authorization
- Error handling and validation
- Client implementation
- Testing strategies
- Performance optimization

## Project Setup

```bash
# Create new project
mkdir product-service
cd product-service
bun init -y

# Install dependencies
bun install verb
bun install -D @types/bun typescript

# Install gRPC utilities
bun install @grpc/grpc-js @grpc/proto-loader
bun install protobufjs
```

## Protocol Buffer Definitions

```
// protos/product.proto
syntax = "proto3";

package product;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

service ProductService {
  // Unary RPCs
  rpc GetProduct(GetProductRequest) returns (Product);
  rpc CreateProduct(CreateProductRequest) returns (Product);
  rpc UpdateProduct(UpdateProductRequest) returns (Product);
  rpc DeleteProduct(DeleteProductRequest) returns (google.protobuf.Empty);
  
  // Server streaming RPC
  rpc ListProducts(ListProductsRequest) returns (stream Product);
  rpc SearchProducts(SearchProductsRequest) returns (stream Product);
  
  // Client streaming RPC
  rpc BulkCreateProducts(stream CreateProductRequest) returns (BulkCreateResponse);
  
  // Bidirectional streaming RPC
  rpc SyncProducts(stream ProductSyncRequest) returns (stream ProductSyncResponse);
}

message Product {
  string id = 1;
  string name = 2;
  string description = 3;
  double price = 4;
  string category = 5;
  repeated string tags = 6;
  int32 stock_quantity = 7;
  string sku = 8;
  ProductStatus status = 9;
  google.protobuf.Timestamp created_at = 10;
  google.protobuf.Timestamp updated_at = 11;
  ProductMetadata metadata = 12;
}

message ProductMetadata {
  double weight = 1;
  repeated string images = 2;
  map<string, string> attributes = 3;
  string vendor = 4;
}

enum ProductStatus {
  UNKNOWN = 0;
  ACTIVE = 1;
  INACTIVE = 2;
  OUT_OF_STOCK = 3;
  DISCONTINUED = 4;
}

message GetProductRequest {
  string id = 1;
}

message CreateProductRequest {
  string name = 1;
  string description = 2;
  double price = 3;
  string category = 4;
  repeated string tags = 5;
  int32 stock_quantity = 6;
  string sku = 7;
  ProductMetadata metadata = 8;
}

message UpdateProductRequest {
  string id = 1;
  optional string name = 2;
  optional string description = 3;
  optional double price = 4;
  optional string category = 5;
  repeated string tags = 6;
  optional int32 stock_quantity = 7;
  optional ProductStatus status = 8;
  optional ProductMetadata metadata = 9;
}

message DeleteProductRequest {
  string id = 1;
}

message ListProductsRequest {
  int32 page_size = 1;
  string page_token = 2;
  string category = 3;
  ProductStatus status = 4;
  string order_by = 5;
}

message SearchProductsRequest {
  string query = 1;
  repeated string categories = 2;
  double min_price = 3;
  double max_price = 4;
  repeated string tags = 5;
  int32 limit = 6;
}

message BulkCreateResponse {
  int32 created_count = 1;
  int32 failed_count = 2;
  repeated string created_ids = 3;
  repeated BulkError errors = 4;
}

message BulkError {
  int32 index = 1;
  string error = 2;
  string product_name = 3;
}

message ProductSyncRequest {
  enum SyncType {
    SUBSCRIBE = 0;
    UPDATE = 1;
    DELETE = 2;
  }
  
  SyncType type = 1;
  string product_id = 2;
  Product product = 3;
}

message ProductSyncResponse {
  enum ResponseType {
    INITIAL_DATA = 0;
    UPDATE = 1;
    DELETE = 2;
    ERROR = 3;
  }
  
  ResponseType type = 1;
  Product product = 2;
  string error = 3;
  google.protobuf.Timestamp timestamp = 4;
}
```

## gRPC Server Implementation

```typescript
// src/server.ts
import { createServer, ServerProtocol } from "verb";
import { ProductService } from "./services/ProductService";
import { authMiddleware } from "./middleware/auth";
import { loggingMiddleware } from "./middleware/logging";
import { validationMiddleware } from "./middleware/validation";

const app = createServer(ServerProtocol.GRPC);

app.withOptions({
  port: 50051,
  grpc: {
    maxReceiveMessageLength: 4 * 1024 * 1024, // 4MB
    maxSendMessageLength: 4 * 1024 * 1024,    // 4MB
    keepaliveTimeMs: 30000,
    keepaliveTimeoutMs: 5000,
    keepalivePermitWithoutCalls: true
  }
});

// Global middleware
app.use(loggingMiddleware);
app.use(authMiddleware);
app.use(validationMiddleware);

// Add the product service
app.addService({
  name: "ProductService",
  protoFile: "./protos/product.proto",
  
  methods: {
    // Unary RPC: Get single product
    GetProduct: {
      handler: async (call) => {
        const { id } = call.request;
        
        if (!id) {
          throw new GrpcError(
            GrpcStatus.INVALID_ARGUMENT,
            "Product ID is required"
          );
        }
        
        const product = await ProductService.findById(id);
        if (!product) {
          throw new GrpcError(
            GrpcStatus.NOT_FOUND,
            `Product with ID ${id} not found`
          );
        }
        
        return product;
      }
    },
    
    // Unary RPC: Create product
    CreateProduct: {
      handler: async (call) => {
        const productData = call.request;
        const userId = call.metadata.get("user-id")?.[0];
        
        // Validate required fields
        if (!productData.name || !productData.price) {
          throw new GrpcError(
            GrpcStatus.INVALID_ARGUMENT,
            "Product name and price are required"
          );
        }
        
        // Check permissions
        if (!await hasPermission(userId, "product:create")) {
          throw new GrpcError(
            GrpcStatus.PERMISSION_DENIED,
            "Insufficient permissions to create products"
          );
        }
        
        try {
          const product = await ProductService.create(productData);
          
          // Publish event for real-time updates
          await publishProductEvent("product.created", product);
          
          return product;
        } catch (error) {
          if (error.code === "DUPLICATE_SKU") {
            throw new GrpcError(
              GrpcStatus.ALREADY_EXISTS,
              `Product with SKU ${productData.sku} already exists`
            );
          }
          throw new GrpcError(GrpcStatus.INTERNAL, "Failed to create product");
        }
      }
    },
    
    // Unary RPC: Update product
    UpdateProduct: {
      handler: async (call) => {
        const { id, ...updateData } = call.request;
        const userId = call.metadata.get("user-id")?.[0];
        
        // Check if product exists
        const existingProduct = await ProductService.findById(id);
        if (!existingProduct) {
          throw new GrpcError(
            GrpcStatus.NOT_FOUND,
            `Product with ID ${id} not found`
          );
        }
        
        // Check permissions
        if (!await hasPermission(userId, "product:update")) {
          throw new GrpcError(
            GrpcStatus.PERMISSION_DENIED,
            "Insufficient permissions to update products"
          );
        }
        
        try {
          const updatedProduct = await ProductService.update(id, updateData);
          
          // Publish event for real-time updates
          await publishProductEvent("product.updated", updatedProduct);
          
          return updatedProduct;
        } catch (error) {
          throw new GrpcError(GrpcStatus.INTERNAL, "Failed to update product");
        }
      }
    },
    
    // Unary RPC: Delete product
    DeleteProduct: {
      handler: async (call) => {
        const { id } = call.request;
        const userId = call.metadata.get("user-id")?.[0];
        
        // Check if product exists
        const existingProduct = await ProductService.findById(id);
        if (!existingProduct) {
          throw new GrpcError(
            GrpcStatus.NOT_FOUND,
            `Product with ID ${id} not found`
          );
        }
        
        // Check permissions
        if (!await hasPermission(userId, "product:delete")) {
          throw new GrpcError(
            GrpcStatus.PERMISSION_DENIED,
            "Insufficient permissions to delete products"
          );
        }
        
        await ProductService.delete(id);
        
        // Publish event for real-time updates
        await publishProductEvent("product.deleted", { id });
        
        return {}; // Empty response
      }
    },
    
    // Server streaming RPC: List products
    ListProducts: {
      handler: async function* (call) {
        const { pageSize = 20, pageToken, category, status, orderBy } = call.request;
        
        const filters = {
          category,
          status,
          orderBy: orderBy || "created_at DESC"
        };
        
        let currentToken = pageToken;
        
        while (true) {
          const result = await ProductService.findMany({
            ...filters,
            limit: pageSize,
            pageToken: currentToken
          });
          
          // Yield each product
          for (const product of result.products) {
            yield product;
          }
          
          // Check if there are more pages
          if (!result.nextPageToken) {
            break;
          }
          
          currentToken = result.nextPageToken;
        }
      }
    },
    
    // Server streaming RPC: Search products
    SearchProducts: {
      handler: async function* (call) {
        const { query, categories, minPrice, maxPrice, tags, limit = 100 } = call.request;
        
        const searchFilters = {
          query,
          categories: categories || [],
          priceRange: minPrice || maxPrice ? { min: minPrice, max: maxPrice } : undefined,
          tags: tags || [],
          limit
        };
        
        // Stream search results
        const searchResults = ProductService.search(searchFilters);
        
        for await (const product of searchResults) {
          yield product;
        }
      }
    },
    
    // Client streaming RPC: Bulk create products
    BulkCreateProducts: {
      handler: async (requestStream) => {
        const results = {
          createdCount: 0,
          failedCount: 0,
          createdIds: [],
          errors: []
        };
        
        let index = 0;
        
        try {
          for await (const productRequest of requestStream) {
            try {
              // Validate product data
              if (!productRequest.name || !productRequest.price) {
                throw new Error("Name and price are required");
              }
              
              const product = await ProductService.create(productRequest);
              results.createdCount++;
              results.createdIds.push(product.id);
              
              // Publish event for each created product
              await publishProductEvent("product.created", product);
              
            } catch (error) {
              results.failedCount++;
              results.errors.push({
                index,
                error: error.message,
                productName: productRequest.name || "Unknown"
              });
            }
            
            index++;
          }
          
          return results;
        } catch (error) {
          throw new GrpcError(
            GrpcStatus.INTERNAL,
            `Bulk create failed: ${error.message}`
          );
        }
      }
    },
    
    // Bidirectional streaming RPC: Sync products
    SyncProducts: {
      handler: async function* (requestStream) {
        const subscriptions = new Set();
        
        try {
          // Send initial data
          const allProducts = await ProductService.findMany({ limit: 1000 });
          for (const product of allProducts.products) {
            yield {
              type: "INITIAL_DATA",
              product,
              timestamp: new Date()
            };
          }
          
          // Process incoming sync requests
          const processRequests = async () => {
            for await (const request of requestStream) {
              switch (request.type) {
                case "SUBSCRIBE":
                  subscriptions.add(request.productId);
                  break;
                  
                case "UPDATE":
                  if (request.product) {
                    try {
                      const updatedProduct = await ProductService.update(
                        request.productId,
                        request.product
                      );
                      
                      yield {
                        type: "UPDATE",
                        product: updatedProduct,
                        timestamp: new Date()
                      };
                    } catch (error) {
                      yield {
                        type: "ERROR",
                        error: error.message,
                        timestamp: new Date()
                      };
                    }
                  }
                  break;
                  
                case "DELETE":
                  try {
                    await ProductService.delete(request.productId);
                    yield {
                      type: "DELETE",
                      product: { id: request.productId },
                      timestamp: new Date()
                    };
                  } catch (error) {
                    yield {
                      type: "ERROR",
                      error: error.message,
                      timestamp: new Date()
                    };
                  }
                  break;
              }
            }
          };
          
          // Start processing requests in background
          processRequests().catch(console.error);
          
          // Keep connection alive and send updates
          while (true) {
            // In a real implementation, you'd listen for database changes
            // and yield updates when subscribed products change
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          
        } finally {
          subscriptions.clear();
        }
      }
    }
  }
});

app.listen(50051);
console.log("🚀 gRPC Product Service running on port 50051");
```

## Product Service Implementation

```typescript
// src/services/ProductService.ts
import { Database } from "bun:sqlite";
import { Product, ProductStatus } from "../types";

const db = new Database("products.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT,
    tags TEXT, -- JSON array
    stock_quantity INTEGER DEFAULT 0,
    sku TEXT UNIQUE,
    status TEXT DEFAULT 'ACTIVE',
    metadata TEXT, -- JSON object
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
  CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
  CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
`);

export class ProductService {
  static async findById(id: string): Promise<Product | null> {
    const row = db.query("SELECT * FROM products WHERE id = ?").get(id);
    return row ? this.mapRowToProduct(row) : null;
  }
  
  static async findMany(options: {
    limit?: number;
    pageToken?: string;
    category?: string;
    status?: ProductStatus;
    orderBy?: string;
  }) {
    let query = "SELECT * FROM products WHERE 1=1";
    const params: any[] = [];
    
    if (options.category) {
      query += " AND category = ?";
      params.push(options.category);
    }
    
    if (options.status) {
      query += " AND status = ?";
      params.push(options.status);
    }
    
    // Add ordering
    query += ` ORDER BY ${options.orderBy || "created_at DESC"}`;
    
    // Add pagination
    const limit = Math.min(options.limit || 20, 100);
    query += " LIMIT ?";
    params.push(limit + 1); // Get one extra to check if there's a next page
    
    if (options.pageToken) {
      // Decode page token (in real implementation, this would be more sophisticated)
      const offset = parseInt(atob(options.pageToken));
      query += " OFFSET ?";
      params.push(offset);
    }
    
    const rows = db.query(query).all(...params);
    const hasMore = rows.length > limit;
    const products = rows.slice(0, limit).map(this.mapRowToProduct);
    
    let nextPageToken;
    if (hasMore) {
      const offset = (options.pageToken ? parseInt(atob(options.pageToken)) : 0) + limit;
      nextPageToken = btoa(offset.toString());
    }
    
    return {
      products,
      nextPageToken
    };
  }
  
  static async* search(filters: {
    query?: string;
    categories?: string[];
    priceRange?: { min?: number; max?: number };
    tags?: string[];
    limit?: number;
  }) {
    let query = "SELECT * FROM products WHERE 1=1";
    const params: any[] = [];
    
    if (filters.query) {
      query += " AND (name LIKE ? OR description LIKE ?)";
      const searchTerm = `%${filters.query}%`;
      params.push(searchTerm, searchTerm);
    }
    
    if (filters.categories && filters.categories.length > 0) {
      const placeholders = filters.categories.map(() => "?").join(",");
      query += ` AND category IN (${placeholders})`;
      params.push(...filters.categories);
    }
    
    if (filters.priceRange) {
      if (filters.priceRange.min !== undefined) {
        query += " AND price >= ?";
        params.push(filters.priceRange.min);
      }
      if (filters.priceRange.max !== undefined) {
        query += " AND price <= ?";
        params.push(filters.priceRange.max);
      }
    }
    
    if (filters.tags && filters.tags.length > 0) {
      for (const tag of filters.tags) {
        query += " AND tags LIKE ?";
        params.push(`%"${tag}"%`);
      }
    }
    
    query += " ORDER BY created_at DESC";
    
    if (filters.limit) {
      query += " LIMIT ?";
      params.push(filters.limit);
    }
    
    const rows = db.query(query).all(...params);
    
    for (const row of rows) {
      yield this.mapRowToProduct(row);
    }
  }
  
  static async create(productData: any): Promise<Product> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Validate SKU uniqueness
    if (productData.sku) {
      const existing = db.query("SELECT id FROM products WHERE sku = ?").get(productData.sku);
      if (existing) {
        throw new Error("DUPLICATE_SKU");
      }
    }
    
    const product = {
      id,
      name: productData.name,
      description: productData.description || "",
      price: productData.price,
      category: productData.category || "",
      tags: JSON.stringify(productData.tags || []),
      stockQuantity: productData.stockQuantity || 0,
      sku: productData.sku || "",
      status: "ACTIVE",
      metadata: JSON.stringify(productData.metadata || {}),
      createdAt: now,
      updatedAt: now
    };
    
    db.query(`
      INSERT INTO products (
        id, name, description, price, category, tags, stock_quantity, 
        sku, status, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product.id,
      product.name,
      product.description,
      product.price,
      product.category,
      product.tags,
      product.stockQuantity,
      product.sku,
      product.status,
      product.metadata,
      product.createdAt,
      product.updatedAt
    );
    
    return this.findById(id)!;
  }
  
  static async update(id: string, updateData: any): Promise<Product> {
    const updates: string[] = [];
    const params: any[] = [];
    
    // Build dynamic update query
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        const dbColumn = this.mapFieldToColumn(key);
        updates.push(`${dbColumn} = ?`);
        
        if (key === "tags" || key === "metadata") {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
      }
    }
    
    if (updates.length === 0) {
      throw new Error("No fields to update");
    }
    
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);
    
    const result = db.query(`
      UPDATE products SET ${updates.join(", ")} WHERE id = ?
    `).run(...params);
    
    if (result.changes === 0) {
      throw new Error("Product not found");
    }
    
    return this.findById(id)!;
  }
  
  static async delete(id: string): Promise<void> {
    const result = db.query("DELETE FROM products WHERE id = ?").run(id);
    
    if (result.changes === 0) {
      throw new Error("Product not found");
    }
  }
  
  private static mapRowToProduct(row: any): Product {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price,
      category: row.category,
      tags: JSON.parse(row.tags || "[]"),
      stockQuantity: row.stock_quantity,
      sku: row.sku,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: JSON.parse(row.metadata || "{}")
    };
  }
  
  private static mapFieldToColumn(field: string): string {
    const mapping = {
      stockQuantity: "stock_quantity",
      createdAt: "created_at",
      updatedAt: "updated_at"
    };
    
    return mapping[field] || field;
  }
}
```

## Middleware Implementation

```typescript
// src/middleware/auth.ts
import { verify } from "jsonwebtoken";
import { GrpcError, GrpcStatus } from "verb";

export const authMiddleware = async (call: any, next: any) => {
  // Skip auth for certain methods
  const publicMethods = ["GetProduct", "ListProducts", "SearchProducts"];
  if (publicMethods.includes(call.method)) {
    return next();
  }
  
  const metadata = call.metadata;
  const token = metadata.get("authorization")?.[0];
  
  if (!token) {
    throw new GrpcError(
      GrpcStatus.UNAUTHENTICATED,
      "Authentication token required"
    );
  }
  
  try {
    const decoded = verify(token.replace("Bearer ", ""), process.env.JWT_SECRET!) as any;
    
    // Add user info to metadata
    metadata.set("user-id", decoded.userId);
    metadata.set("user-role", decoded.role);
    
    return next();
  } catch (error) {
    throw new GrpcError(
      GrpcStatus.UNAUTHENTICATED,
      "Invalid or expired token"
    );
  }
};

// src/middleware/logging.ts
export const loggingMiddleware = async (call: any, next: any) => {
  const start = Date.now();
  const method = call.method;
  const clientInfo = call.getPeer();
  
  console.log(`[${new Date().toISOString()}] gRPC ${method} started - Client: ${clientInfo}`);
  
  try {
    const result = await next();
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] gRPC ${method} completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[${new Date().toISOString()}] gRPC ${method} failed in ${duration}ms:`, error.message);
    throw error;
  }
};

// src/middleware/validation.ts
export const validationMiddleware = async (call: any, next: any) => {
  const method = call.method;
  const request = call.request;
  
  // Method-specific validation
  switch (method) {
    case "CreateProduct":
    case "UpdateProduct":
      if (request.price !== undefined && request.price < 0) {
        throw new GrpcError(
          GrpcStatus.INVALID_ARGUMENT,
          "Price cannot be negative"
        );
      }
      
      if (request.stockQuantity !== undefined && request.stockQuantity < 0) {
        throw new GrpcError(
          GrpcStatus.INVALID_ARGUMENT,
          "Stock quantity cannot be negative"
        );
      }
      break;
      
    case "GetProduct":
    case "DeleteProduct":
      if (!request.id || request.id.trim() === "") {
        throw new GrpcError(
          GrpcStatus.INVALID_ARGUMENT,
          "Product ID is required"
        );
      }
      break;
  }
  
  return next();
};
```

## gRPC Client Implementation

```typescript
// src/client/ProductClient.ts
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const PROTO_PATH = "./protos/product.proto";

// Load the protobuf
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const productProto = grpc.loadPackageDefinition(packageDefinition).product as any;

export class ProductClient {
  private client: any;
  
  constructor(serverAddress = "localhost:50051", credentials?: grpc.ChannelCredentials) {
    this.client = new productProto.ProductService(
      serverAddress,
      credentials || grpc.credentials.createInsecure()
    );
  }
  
  // Unary call example
  async getProduct(id: string, token?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const metadata = new grpc.Metadata();
      if (token) {
        metadata.set("authorization", `Bearer ${token}`);
      }
      
      this.client.GetProduct({ id }, metadata, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }
  
  // Unary call with authentication
  async createProduct(productData: any, token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const metadata = new grpc.Metadata();
      metadata.set("authorization", `Bearer ${token}`);
      
      this.client.CreateProduct(productData, metadata, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }
  
  // Server streaming example
  async* listProducts(request: any = {}): AsyncGenerator<any> {
    const call = this.client.ListProducts(request);
    
    for await (const product of call) {
      yield product;
    }
  }
  
  // Client streaming example
  async bulkCreateProducts(products: any[], token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const metadata = new grpc.Metadata();
      metadata.set("authorization", `Bearer ${token}`);
      
      const call = this.client.BulkCreateProducts(metadata, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
      
      // Send products
      for (const product of products) {
        call.write(product);
      }
      
      call.end();
    });
  }
  
  // Bidirectional streaming example
  async* syncProducts(token: string): AsyncGenerator<any> {
    const metadata = new grpc.Metadata();
    metadata.set("authorization", `Bearer ${token}`);
    
    const call = this.client.SyncProducts(metadata);
    
    // Subscribe to all products initially
    call.write({
      type: "SUBSCRIBE",
      productId: "*"
    });
    
    // Listen for responses
    for await (const response of call) {
      yield response;
    }
  }
  
  close() {
    this.client.close();
  }
}

// Usage example
export async function clientExample() {
  const client = new ProductClient();
  
  try {
    // Get a product
    const product = await client.getProduct("product-123");
    console.log("Product:", product);
    
    // List products (server streaming)
    console.log("Listing products:");
    for await (const product of client.listProducts({ pageSize: 10 })) {
      console.log("-", product.name);
    }
    
    // Bulk create products (client streaming)
    const productsToCreate = [
      { name: "Product 1", price: 19.99, category: "electronics" },
      { name: "Product 2", price: 29.99, category: "electronics" },
      { name: "Product 3", price: 39.99, category: "books" }
    ];
    
    const bulkResult = await client.bulkCreateProducts(productsToCreate, "your-auth-token");
    console.log("Bulk create result:", bulkResult);
    
    // Sync products (bidirectional streaming)
    console.log("Starting product sync:");
    for await (const syncResponse of client.syncProducts("your-auth-token")) {
      console.log("Sync update:", syncResponse.type, syncResponse.product?.name);
    }
    
  } catch (error) {
    console.error("Client error:", error);
  } finally {
    client.close();
  }
}
```

## Testing gRPC Service

```typescript
// tests/product-service.test.ts
import { test, expect, beforeAll, afterAll } from "bun:test";
import { ProductClient } from "../src/client/ProductClient";
import { startTestServer, stopTestServer } from "./test-utils";

let client: ProductClient;

beforeAll(async () => {
  await startTestServer();
  client = new ProductClient("localhost:50052"); // Test server port
});

afterAll(async () => {
  if (client) {
    client.close();
  }
  await stopTestServer();
});

test("GetProduct returns product by ID", async () => {
  // First create a test product
  const testProduct = {
    name: "Test Product",
    description: "A test product",
    price: 19.99,
    category: "test",
    sku: "TEST-001"
  };
  
  const created = await client.createProduct(testProduct, "test-token");
  
  // Then get it
  const retrieved = await client.getProduct(created.id);
  
  expect(retrieved.id).toBe(created.id);
  expect(retrieved.name).toBe(testProduct.name);
  expect(retrieved.price).toBe(testProduct.price);
});

test("ListProducts returns stream of products", async () => {
  const products = [];
  
  for await (const product of client.listProducts({ pageSize: 5 })) {
    products.push(product);
  }
  
  expect(products.length).toBeGreaterThan(0);
  expect(products[0]).toHaveProperty("id");
  expect(products[0]).toHaveProperty("name");
});

test("BulkCreateProducts creates multiple products", async () => {
  const productsToCreate = [
    { name: "Bulk Product 1", price: 10.00, category: "bulk" },
    { name: "Bulk Product 2", price: 20.00, category: "bulk" },
    { name: "Bulk Product 3", price: 30.00, category: "bulk" }
  ];
  
  const result = await client.bulkCreateProducts(productsToCreate, "test-token");
  
  expect(result.createdCount).toBe(3);
  expect(result.failedCount).toBe(0);
  expect(result.createdIds).toHaveLength(3);
});

test("handles gRPC errors correctly", async () => {
  try {
    await client.getProduct("non-existent-id");
    expect.fail("Should have thrown an error");
  } catch (error) {
    expect(error.code).toBe(5); // NOT_FOUND
    expect(error.message).toContain("not found");
  }
});

test("authentication is required for write operations", async () => {
  try {
    await client.createProduct({
      name: "Unauthorized Product",
      price: 10.00
    }, ""); // No token
    
    expect.fail("Should have thrown an authentication error");
  } catch (error) {
    expect(error.code).toBe(16); // UNAUTHENTICATED
  }
});
```

## Performance Optimization

```typescript
// src/performance/connection-pool.ts
import * as grpc from "@grpc/grpc-js";

export class GrpcConnectionPool {
  private connections: Map<string, any> = new Map();
  private maxConnections = 10;
  
  getClient(address: string, serviceType: any): any {
    if (!this.connections.has(address)) {
      if (this.connections.size >= this.maxConnections) {
        // Remove oldest connection
        const firstKey = this.connections.keys().next().value;
        const oldClient = this.connections.get(firstKey);
        oldClient.close();
        this.connections.delete(firstKey);
      }
      
      const client = new serviceType(
        address,
        grpc.credentials.createInsecure(),
        {
          "grpc.keepalive_time_ms": 30000,
          "grpc.keepalive_timeout_ms": 5000,
          "grpc.keepalive_permit_without_calls": true,
          "grpc.http2.max_pings_without_data": 0,
          "grpc.http2.min_time_between_pings_ms": 10000,
          "grpc.http2.min_ping_interval_without_data_ms": 300000
        }
      );
      
      this.connections.set(address, client);
    }
    
    return this.connections.get(address);
  }
  
  closeAll() {
    for (const client of this.connections.values()) {
      client.close();
    }
    this.connections.clear();
  }
}

// src/performance/caching.ts
export class GrpcResponseCache {
  private cache = new Map<string, { data: any, expiry: number }>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  
  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }
  
  set(key: string, data: any, ttl = this.defaultTTL) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }
  
  clear() {
    this.cache.clear();
  }
}
```

## Running the Application

```bash
# Set environment variables
export JWT_SECRET="your-secret-key"
export NODE_ENV="development"

# Start the gRPC server
bun run src/server.ts

# In another terminal, run the client example
bun run src/client/example.ts

# Run tests
bun test
```

## Key Features Demonstrated

This gRPC service example showcases:

1. **Complete gRPC Implementation**: All four types of gRPC calls
2. **Protocol Buffers**: Comprehensive schema definition
3. **Authentication & Authorization**: JWT-based security
4. **Error Handling**: Proper gRPC status codes and error messages
5. **Streaming**: Server, client, and bidirectional streaming
6. **Database Integration**: SQLite with proper data mapping
7. **Middleware**: Logging, authentication, and validation
8. **Client Implementation**: Full-featured gRPC client
9. **Testing**: Comprehensive test coverage
10. **Performance**: Connection pooling and caching strategies

## See Also

- [gRPC Server API](/api/servers/grpc) - gRPC server configuration
- [Protocol Gateway](/api/protocol-gateway) - Multi-protocol integration
- [Authentication Example](/examples/authentication) - Authentication patterns
- [Microservices Guide](/guide/microservices) - Building microservices with gRPC
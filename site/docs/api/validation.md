# Validation

Comprehensive input validation utilities for request data, parameters, and configuration with built-in validators and custom validation support.

## Validation Schema

### Basic Schema Definition

```typescript
import { Schema, validate } from "verb/validation";

const userSchema = new Schema({
  name: {
    type: "string",
    required: true,
    minLength: 2,
    maxLength: 50,
    trim: true
  },
  email: {
    type: "string", 
    required: true,
    format: "email",
    lowercase: true
  },
  age: {
    type: "number",
    min: 18,
    max: 120,
    integer: true
  },
  role: {
    type: "string",
    enum: ["user", "admin", "moderator"],
    default: "user"
  },
  active: {
    type: "boolean",
    default: true
  }
});

// Usage in route
app.post("/users", (req, res) => {
  const { data, errors } = validate(req.body, userSchema);
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: "Validation failed",
      issues: errors
    });
  }
  
  // data is now validated and sanitized
  const user = createUser(data);
  res.status(201).json(user);
});
```

## Field Types

### String Validation

```typescript
const stringSchema = new Schema({
  username: {
    type: "string",
    required: true,
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_]+$/,
    trim: true,
    lowercase: true
  },
  password: {
    type: "string",
    required: true,
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
  },
  bio: {
    type: "string",
    maxLength: 500,
    trim: true,
    default: ""
  }
});
```

**String Options:**
- `minLength`: Minimum string length
- `maxLength`: Maximum string length
- `pattern`: Regular expression pattern
- `format`: Built-in format (`email`, `url`, `uuid`, `date`, etc.)
- `enum`: Array of allowed values
- `trim`: Remove leading/trailing whitespace
- `lowercase`: Convert to lowercase
- `uppercase`: Convert to uppercase

### Number Validation

```typescript
const numberSchema = new Schema({
  price: {
    type: "number",
    required: true,
    min: 0,
    max: 10000,
    precision: 2 // Allow 2 decimal places
  },
  quantity: {
    type: "number",
    required: true,
    min: 1,
    integer: true
  },
  rating: {
    type: "number",
    min: 1,
    max: 5,
    default: 1
  }
});
```

**Number Options:**
- `min`: Minimum value
- `max`: Maximum value
- `integer`: Must be an integer
- `precision`: Number of decimal places
- `positive`: Must be positive
- `negative`: Must be negative

### Boolean Validation

```typescript
const booleanSchema = new Schema({
  isActive: {
    type: "boolean",
    default: true
  },
  emailNotifications: {
    type: "boolean",
    required: true
  }
});
```

### Array Validation

```typescript
const arraySchema = new Schema({
  tags: {
    type: "array",
    items: {
      type: "string",
      minLength: 1,
      maxLength: 20
    },
    minItems: 1,
    maxItems: 10,
    unique: true
  },
  scores: {
    type: "array",
    items: {
      type: "number",
      min: 0,
      max: 100
    },
    minItems: 3,
    maxItems: 3
  }
});
```

**Array Options:**
- `items`: Schema for array items
- `minItems`: Minimum array length
- `maxItems`: Maximum array length
- `unique`: All items must be unique

### Object Validation

```typescript
const objectSchema = new Schema({
  address: {
    type: "object",
    properties: {
      street: {
        type: "string",
        required: true,
        maxLength: 100
      },
      city: {
        type: "string", 
        required: true,
        maxLength: 50
      },
      zipCode: {
        type: "string",
        required: true,
        pattern: /^\d{5}(-\d{4})?$/
      },
      country: {
        type: "string",
        required: true,
        enum: ["US", "CA", "UK", "AU"]
      }
    },
    required: true
  }
});
```

### Date Validation

```typescript
const dateSchema = new Schema({
  birthDate: {
    type: "date",
    required: true,
    before: new Date(), // Must be in the past
    after: new Date("1900-01-01")
  },
  eventDate: {
    type: "date",
    after: new Date(), // Must be in the future
    format: "YYYY-MM-DD"
  }
});
```

## Built-in Formats

### Email Validation

```typescript
const emailSchema = new Schema({
  email: {
    type: "string",
    required: true,
    format: "email",
    lowercase: true
  }
});
```

### URL Validation

```typescript
const urlSchema = new Schema({
  website: {
    type: "string",
    format: "url",
    protocols: ["http", "https"]
  }
});
```

### UUID Validation

```typescript
const uuidSchema = new Schema({
  id: {
    type: "string",
    format: "uuid",
    version: 4 // UUID v4
  }
});
```

### Phone Number Validation

```typescript
const phoneSchema = new Schema({
  phone: {
    type: "string",
    format: "phone",
    region: "US" // E.164 format for US
  }
});
```

### Credit Card Validation

```typescript
const cardSchema = new Schema({
  cardNumber: {
    type: "string",
    format: "creditcard",
    types: ["visa", "mastercard", "amex"]
  }
});
```

## Custom Validators

### Custom Validation Functions

```typescript
const customSchema = new Schema({
  username: {
    type: "string",
    required: true,
    validate: async (value) => {
      const exists = await checkUsernameExists(value);
      if (exists) {
        throw new Error("Username already exists");
      }
      return value;
    }
  },
  password: {
    type: "string",
    required: true,
    validate: (value) => {
      const score = calculatePasswordStrength(value);
      if (score < 3) {
        throw new Error("Password is too weak");
      }
      return value;
    }
  }
});
```

### Conditional Validation

```typescript
const conditionalSchema = new Schema({
  type: {
    type: "string",
    enum: ["individual", "business"],
    required: true
  },
  ssn: {
    type: "string",
    pattern: /^\d{3}-\d{2}-\d{4}$/,
    when: {
      field: "type",
      is: "individual",
      then: { required: true }
    }
  },
  ein: {
    type: "string",
    pattern: /^\d{2}-\d{7}$/,
    when: {
      field: "type", 
      is: "business",
      then: { required: true }
    }
  }
});
```

### Cross-Field Validation

```typescript
const crossFieldSchema = new Schema({
  password: {
    type: "string",
    required: true,
    minLength: 8
  },
  confirmPassword: {
    type: "string",
    required: true,
    validate: (value, data) => {
      if (value !== data.password) {
        throw new Error("Passwords do not match");
      }
      return value;
    }
  },
  startDate: {
    type: "date",
    required: true
  },
  endDate: {
    type: "date",
    required: true,
    validate: (value, data) => {
      if (value <= data.startDate) {
        throw new Error("End date must be after start date");
      }
      return value;
    }
  }
});
```

## Validation Middleware

### Route-Level Validation

```typescript
import { validateBody, validateParams, validateQuery } from "verb/validation";

// Body validation
app.post("/users", 
  validateBody(userSchema),
  (req, res) => {
    // req.body is validated and sanitized
    const user = createUser(req.body);
    res.status(201).json(user);
  }
);

// Parameters validation
const paramsSchema = new Schema({
  id: {
    type: "string",
    format: "uuid",
    required: true
  }
});

app.get("/users/:id", 
  validateParams(paramsSchema),
  (req, res) => {
    // req.params.id is validated
    const user = getUserById(req.params.id);
    res.json(user);
  }
);

// Query validation
const querySchema = new Schema({
  page: {
    type: "number",
    min: 1,
    default: 1,
    integer: true
  },
  limit: {
    type: "number",
    min: 1,
    max: 100,
    default: 20,
    integer: true
  },
  search: {
    type: "string",
    maxLength: 100,
    trim: true
  }
});

app.get("/users", 
  validateQuery(querySchema),
  (req, res) => {
    // req.query is validated
    const users = searchUsers(req.query);
    res.json(users);
  }
);
```

### Custom Validation Middleware

```typescript
const createValidator = (schema: Schema, source: "body" | "params" | "query") => {
  return (req: VerbRequest, res: VerbResponse, next: NextFunction) => {
    const data = req[source];
    const { data: validatedData, errors } = validate(data, schema);
    
    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: `Invalid ${source}`,
        issues: errors.map(err => ({
          field: err.field,
          message: err.message,
          value: err.value
        }))
      });
    }
    
    // Replace with validated data
    req[source] = validatedData;
    next();
  };
};

// Usage
app.post("/users", 
  createValidator(userSchema, "body"),
  (req, res) => {
    const user = createUser(req.body);
    res.status(201).json(user);
  }
);
```

## File Upload Validation

### File Type Validation

```typescript
import { validateFile } from "verb/validation";

const fileSchema = new Schema({
  avatar: {
    type: "file",
    required: true,
    mimetype: ["image/jpeg", "image/png", "image/gif"],
    maxSize: "5MB",
    dimensions: {
      maxWidth: 1024,
      maxHeight: 1024
    }
  },
  document: {
    type: "file",
    mimetype: ["application/pdf", "application/msword"],
    maxSize: "10MB"
  }
});

app.post("/upload", 
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "document", maxCount: 1 }
  ]),
  validateFile(fileSchema),
  (req, res) => {
    // Files are validated
    res.json({ success: true });
  }
);
```

## Error Handling

### Validation Error Format

```typescript
interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code: string;
}

// Example validation error response
{
  "error": "Validation Error",
  "message": "Request validation failed",
  "issues": [
    {
      "field": "email",
      "message": "Invalid email format",
      "value": "invalid-email",
      "code": "INVALID_FORMAT"
    },
    {
      "field": "age",
      "message": "Must be at least 18",
      "value": 16,
      "code": "MIN_VALUE"
    }
  ]
}
```

### Custom Error Messages

```typescript
const customMessageSchema = new Schema({
  username: {
    type: "string",
    required: {
      value: true,
      message: "Please provide a username"
    },
    minLength: {
      value: 3,
      message: "Username must be at least 3 characters long"
    },
    pattern: {
      value: /^[a-zA-Z0-9_]+$/,
      message: "Username can only contain letters, numbers, and underscores"
    }
  },
  age: {
    type: "number",
    min: {
      value: 18,
      message: "You must be at least 18 years old"
    }
  }
});
```

## Schema Composition

### Extending Schemas

```typescript
const baseUserSchema = new Schema({
  name: {
    type: "string",
    required: true,
    maxLength: 50
  },
  email: {
    type: "string",
    required: true,
    format: "email"
  }
});

const adminUserSchema = baseUserSchema.extend({
  permissions: {
    type: "array",
    items: {
      type: "string",
      enum: ["read", "write", "delete", "admin"]
    },
    required: true
  },
  department: {
    type: "string",
    required: true,
    enum: ["IT", "HR", "Finance", "Operations"]
  }
});
```

### Schema Merging

```typescript
const personalInfoSchema = new Schema({
  firstName: { type: "string", required: true },
  lastName: { type: "string", required: true }
});

const contactInfoSchema = new Schema({
  email: { type: "string", format: "email", required: true },
  phone: { type: "string", format: "phone" }
});

const userRegistrationSchema = Schema.merge([
  personalInfoSchema,
  contactInfoSchema,
  {
    password: {
      type: "string",
      required: true,
      minLength: 8
    }
  }
]);
```

## Performance Optimization

### Schema Compilation

```typescript
// Compile schema for better performance
const compiledSchema = userSchema.compile();

// Use compiled schema for validation
app.post("/users", (req, res) => {
  const { data, errors } = compiledSchema.validate(req.body);
  
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  
  const user = createUser(data);
  res.status(201).json(user);
});
```

### Validation Caching

```typescript
const validationCache = new Map();

const cachedValidate = (data: any, schema: Schema) => {
  const key = JSON.stringify(data);
  
  if (validationCache.has(key)) {
    return validationCache.get(key);
  }
  
  const result = validate(data, schema);
  validationCache.set(key, result);
  
  return result;
};
```

## Testing Validation

### Unit Tests

```typescript
import { test, expect } from "bun:test";

test("validates user schema", () => {
  const validUser = {
    name: "John Doe",
    email: "john@example.com",
    age: 25
  };
  
  const { data, errors } = validate(validUser, userSchema);
  
  expect(errors).toHaveLength(0);
  expect(data.name).toBe("John Doe");
  expect(data.role).toBe("user"); // Default value
});

test("rejects invalid user", () => {
  const invalidUser = {
    name: "",
    email: "invalid-email",
    age: 17
  };
  
  const { errors } = validate(invalidUser, userSchema);
  
  expect(errors).toHaveLength(3);
  expect(errors[0].field).toBe("name");
  expect(errors[1].field).toBe("email");
  expect(errors[2].field).toBe("age");
});
```

### Integration Tests

```typescript
import request from "supertest";

test("validates POST /users", async () => {
  const invalidUser = {
    name: "",
    email: "invalid"
  };
  
  const response = await request(app)
    .post("/users")
    .send(invalidUser)
    .expect(400);
    
  expect(response.body.error).toBe("Validation Error");
  expect(response.body.issues).toHaveLength(2);
});
```

## Best Practices

1. **Define Clear Schemas**: Use descriptive validation rules
2. **Custom Error Messages**: Provide user-friendly error messages
3. **Sanitize Input**: Clean and normalize data during validation
4. **Validate Early**: Validate input as soon as possible
5. **Performance**: Compile schemas for repeated use
6. **Security**: Validate all external input
7. **Testing**: Write comprehensive validation tests

## See Also

- [Error Handling](/api/error-handling) - Handling validation errors
- [Middleware API](/api/middleware) - Creating validation middleware
- [Security](/guide/security) - Input security best practices
- [Request API](/api/request) - Request object validation
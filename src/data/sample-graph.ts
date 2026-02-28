import type { GraphData } from "@/types/graph";

/**
 * Sample graph data for development — a fake auth module with ~18 nodes.
 */
export const sampleGraph: GraphData = {
  nodes: [
    // Files
    { id: "f:auth/index.ts", name: "auth/index.ts", type: "file", filePath: "src/auth/index.ts", val: 8, color: "#6366f1" },
    { id: "f:auth/login.ts", name: "auth/login.ts", type: "file", filePath: "src/auth/login.ts", val: 6, color: "#6366f1" },
    { id: "f:auth/session.ts", name: "auth/session.ts", type: "file", filePath: "src/auth/session.ts", val: 5, color: "#6366f1" },
    { id: "f:auth/middleware.ts", name: "auth/middleware.ts", type: "file", filePath: "src/auth/middleware.ts", val: 5, color: "#6366f1" },
    { id: "f:db/users.ts", name: "db/users.ts", type: "file", filePath: "src/db/users.ts", val: 6, color: "#6366f1" },
    { id: "f:utils/hash.ts", name: "utils/hash.ts", type: "file", filePath: "src/utils/hash.ts", val: 3, color: "#6366f1" },

    // Functions
    { id: "fn:authenticateUser", name: "authenticateUser", type: "function", filePath: "src/auth/login.ts", val: 10, color: "#f59e0b", summary: "Main login entry: validates credentials, creates session" },
    { id: "fn:validateCredentials", name: "validateCredentials", type: "function", filePath: "src/auth/login.ts", val: 7, color: "#f59e0b", summary: "Checks email/password against DB" },
    { id: "fn:createSession", name: "createSession", type: "function", filePath: "src/auth/session.ts", val: 8, color: "#f59e0b", summary: "Creates JWT session token" },
    { id: "fn:verifySession", name: "verifySession", type: "function", filePath: "src/auth/session.ts", val: 7, color: "#f59e0b", summary: "Validates JWT and returns user context" },
    { id: "fn:requireAuth", name: "requireAuth", type: "function", filePath: "src/auth/middleware.ts", val: 6, color: "#f59e0b", summary: "Express middleware that checks session" },
    { id: "fn:hashPassword", name: "hashPassword", type: "function", filePath: "src/utils/hash.ts", val: 4, color: "#f59e0b", summary: "Bcrypt hash wrapper" },
    { id: "fn:comparePassword", name: "comparePassword", type: "function", filePath: "src/utils/hash.ts", val: 4, color: "#f59e0b", summary: "Bcrypt compare wrapper" },
    { id: "fn:findUserByEmail", name: "findUserByEmail", type: "function", filePath: "src/db/users.ts", val: 5, color: "#f59e0b", summary: "DB query: find user by email" },
    { id: "fn:createUser", name: "createUser", type: "function", filePath: "src/db/users.ts", val: 5, color: "#f59e0b", summary: "DB insert: create new user record" },

    // Classes
    { id: "c:AuthService", name: "AuthService", type: "class", filePath: "src/auth/index.ts", val: 12, color: "#10b981", summary: "Orchestrates auth flows" },
    { id: "c:SessionStore", name: "SessionStore", type: "class", filePath: "src/auth/session.ts", val: 9, color: "#10b981", summary: "In-memory session storage" },
    { id: "c:UserRepository", name: "UserRepository", type: "class", filePath: "src/db/users.ts", val: 8, color: "#10b981", summary: "Data access layer for users table" },
  ],
  links: [
    // CONTAINS: file → function/class
    { source: "f:auth/index.ts", target: "c:AuthService", type: "contains" },
    { source: "f:auth/login.ts", target: "fn:authenticateUser", type: "contains" },
    { source: "f:auth/login.ts", target: "fn:validateCredentials", type: "contains" },
    { source: "f:auth/session.ts", target: "fn:createSession", type: "contains" },
    { source: "f:auth/session.ts", target: "fn:verifySession", type: "contains" },
    { source: "f:auth/session.ts", target: "c:SessionStore", type: "contains" },
    { source: "f:auth/middleware.ts", target: "fn:requireAuth", type: "contains" },
    { source: "f:utils/hash.ts", target: "fn:hashPassword", type: "contains" },
    { source: "f:utils/hash.ts", target: "fn:comparePassword", type: "contains" },
    { source: "f:db/users.ts", target: "fn:findUserByEmail", type: "contains" },
    { source: "f:db/users.ts", target: "fn:createUser", type: "contains" },
    { source: "f:db/users.ts", target: "c:UserRepository", type: "contains" },

    // CALLS: function → function
    { source: "fn:authenticateUser", target: "fn:validateCredentials", type: "calls" },
    { source: "fn:authenticateUser", target: "fn:createSession", type: "calls" },
    { source: "fn:validateCredentials", target: "fn:findUserByEmail", type: "calls" },
    { source: "fn:validateCredentials", target: "fn:comparePassword", type: "calls" },
    { source: "fn:requireAuth", target: "fn:verifySession", type: "calls" },
    { source: "fn:createUser", target: "fn:hashPassword", type: "calls" },

    // IMPORTS: file → file
    { source: "f:auth/index.ts", target: "f:auth/login.ts", type: "imports" },
    { source: "f:auth/index.ts", target: "f:auth/session.ts", type: "imports" },
    { source: "f:auth/login.ts", target: "f:db/users.ts", type: "imports" },
    { source: "f:auth/login.ts", target: "f:utils/hash.ts", type: "imports" },
    { source: "f:auth/middleware.ts", target: "f:auth/session.ts", type: "imports" },
  ],
};

import type { ListenOptions } from "../types";

export interface GrpcMethod {
  name: string;
  requestType: string;
  responseType: string;
  handler: (request: any) => Promise<any> | any;
}

export interface GrpcService {
  name: string;
  methods: GrpcMethod[];
}

export interface GrpcServerInstance {
  addService: (service: GrpcService) => void;
  addMethod: (serviceName: string, method: GrpcMethod) => void;
  listen: (port?: number, hostname?: string) => Promise<any>;
  withOptions: (options: ListenOptions) => void;
}

export const createGrpcServer = (): GrpcServerInstance => {
  const services: Map<string, GrpcService> = new Map();
  let serverOptions: ListenOptions | null = null;

  const addService = (service: GrpcService) => {
    services.set(service.name, service);
  };

  const addMethod = (serviceName: string, method: GrpcMethod) => {
    const service = services.get(serviceName);
    if (service) {
      service.methods.push(method);
    } else {
      // Create new service with this method
      const newService: GrpcService = {
        name: serviceName,
        methods: [method],
      };
      services.set(serviceName, newService);
    }
  };

  const withOptions = (options: ListenOptions) => {
    serverOptions = options;
  };

  const logServices = () => {
    console.log("\n📋 gRPC Server Services:");
    console.log("========================");

    if (services.size === 0) {
      console.log("  No services registered");
      return;
    }

    services.forEach((service, serviceName) => {
      console.log(`  Service: ${serviceName}`);
      service.methods.forEach((method) => {
        console.log(`    ${method.name} (${method.requestType}) -> ${method.responseType}`);
      });
    });

    console.log("");
  };

  const listen = async (port?: number, hostname?: string) => {
    // Use stored options, or create default config
    const finalPort = port ?? serverOptions?.port ?? 50051; // Default gRPC port
    const finalHostname = hostname ?? serverOptions?.hostname ?? "localhost";

    console.log(`🚀 gRPC Server starting on ${finalHostname}:${finalPort}`);

    // Show services if enabled
    if (serverOptions?.showRoutes) {
      logServices();
    }

    // Note: This is a simplified gRPC server implementation
    // In a real implementation, you would use a proper gRPC library
    const server = {
      port: finalPort,
      hostname: finalHostname,
      services: Array.from(services.values()),
      stop: () => {
        console.log("🛑 gRPC Server stopped");
      },
    };

    return server;
  };

  return {
    addService,
    addMethod,
    listen,
    withOptions,
  };
};

// Helper functions for creating gRPC services
export const createGrpcService = (name: string, methods: GrpcMethod[]): GrpcService => {
  return {
    name,
    methods,
  };
};

export const createGrpcMethod = (
  name: string,
  requestType: string,
  responseType: string,
  handler: (request: any) => Promise<any> | any,
): GrpcMethod => {
  return {
    name,
    requestType,
    responseType,
    handler,
  };
};

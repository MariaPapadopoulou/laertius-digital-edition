import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

// Second spec (the ontology-first Legomena service): title pinned to
// "Legomena" so its generated output is `legomena.ts` and can never collide
// with the primary client's files.
const legomenaTitleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Legomena";

  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
  "legomena-client-react": {
    input: {
      target: "./legomena.yaml",
      override: {
        transformer: legomenaTitleTransformer,
      },
    },
    output: {
      // No `workspace`: orval must not append these exports to the package's
      // root index.ts barrel (names would collide with the primary client).
      // The subpath export src/legomena.ts re-exports them instead.
      target: path.resolve(apiClientReactSrc, "generated-legomena", "legomena.ts"),
      client: "react-query",
      mode: "split",
      baseUrl: "/legomena/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  "legomena-zod": {
    input: {
      target: "./legomena.yaml",
      override: {
        transformer: legomenaTitleTransformer,
      },
    },
    output: {
      // No `workspace` for the same reason as legomena-client-react above.
      client: "zod",
      target: path.resolve(apiZodSrc, "generated-legomena", "legomena.ts"),
      schemas: {
        path: path.resolve(apiZodSrc, "generated-legomena", "types"),
        type: "typescript",
      },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});

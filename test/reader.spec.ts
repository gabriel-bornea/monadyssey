import { describe, expect, it } from "@jest/globals";
import { IO, Reader } from "../src";

describe("Reader", () => {
  describe("constructor", () => {
    it("should create a new Reader instance", () => {
      const reader = new Reader((env: string) => env);
      expect(reader.run("env")).toBe("env");
    });

    it("should create a new Reader instance with a custom run function", () => {
      type Ask = { ask: () => string };
      type Say = { say: (message: string) => string };

      const greeting = new Reader<Ask & Say, string>((ctx) => {
        const name = ctx.ask();
        return ctx.say(`Hello ${name}`);
      });

      const ctx: Ask & Say = {
        ask: () => "Alice",
        say: (message) => message,
      };

      const result = greeting.run(ctx);
      expect(result).toBe("Hello Alice");
    });

    it("should handle null or undefined environment gracefully", () => {
      const reader = new Reader((env: any) => env);
      expect(reader.run(null)).toBe(null);
      expect(reader.run(undefined)).toBe(undefined);
    });

    it("should handle a complex environment object", () => {
      type ComplexEnv = { user: { name: string; id: number }; settings: { theme: string } };
      const reader = new Reader<ComplexEnv, string>((ctx) => `${ctx.user.name} uses ${ctx.settings.theme}`);
      const context: ComplexEnv = { user: { name: "Alice", id: 1 }, settings: { theme: "dark" } };
      const result = reader.run(context);
      expect(result).toBe("Alice uses dark");
    });
  });

  describe("of", () => {
    it("it should create a new Reader ignoring the environment", () => {
      const reader = Reader.of(42);
      expect(reader.run("env")).toBe(42);
    });
  });

  describe("map", () => {
    it("should transform the result by applying the provided function", () => {
      const reader = Reader.of(42);
      const result = reader.map((x) => x * 2);
      expect(result.run("env")).toBe(84);
    });

    it("should propagate the error occurred during transformation", () => {
      const reader = Reader.of(42);
      const result = reader.map((_) => {
        throw new Error("Error occurred");
      });
      expect(() => result.run("env")).toThrowError("Error occurred");
    });
  });

  describe("flatMap", () => {
    it("should chain multiple readers together", () => {
      const reader1 = Reader.of(2);
      const reader2 = (num: number) => Reader.of(num * 3);
      const result = reader1.flatMap((x) => reader2(x));
      expect(result.run("env")).toBe(6);
    });
  });

  describe("ask", () => {
    it("should create a Reader instance that provides access to the environment", () => {
      const reader = Reader.ask<string>();
      expect(reader.run("env")).toBe("env");
    });
  });

  describe("lift", () => {
    it("should lift a function into the Reader context, allowing it to be applied to the result", () => {
      const addOne = (x: number) => x + 1;
      const reader = Reader.of(42);
      const result = Reader.lift(addOne)(reader);
      expect(result.run("env")).toBe(43);
    });
  });

  describe("parZip", () => {
    it("should combines multiple instances into a single Reader", () => {
      const reader1 = Reader.of(1);
      const reader2 = Reader.of(2);
      const reader3 = Reader.of(3);
      const result = Reader.parZip(reader1, reader2, reader3);
      expect(result.run("env")).toEqual([1, 2, 3]);
    });
  });

  describe("local", () => {
    it("should create a new Reader that applies a transformation to the environment", () => {
      type Env = { endpoint: string; version: string };

      const reader = Reader.ask<Env>().map((env) => `${env.endpoint}/${env.version}`);
      const env2 = (env: Env) => ({ ...env, version: "v2" });

      const modified = Reader.local(env2, reader);
      const env: Env = { endpoint: "https://api.example.com", version: "v1" };

      expect(reader.run(env)).toEqual("https://api.example.com/v1");
      expect(modified.run(env)).toEqual("https://api.example.com/v2");
    });
  });

  describe("dependency injection", () => {
    it("should provide dependency injection capability", async () => {
      type User = { id: string; username: string; email: string };
      type Document = { name: string; createdOn: Date; createdBy: string };

      class UserService {
        getById = (id: string): IO<Error, User> =>
          IO.ofSync(() => {
            return { id: id, username: "username", email: "username@mail.local" };
          });
      }

      class DocumentService {
        getByUsername = (username: string): IO<Error, Document> =>
          IO.ofSync(() => {
            return { name: "document.pdf", createdOn: new Date(), createdBy: username };
          });
      }

      interface Context {
        userService: UserService;
        documentService: DocumentService;
      }

      class UserDocumentService {
        getById = (id: string): Reader<Context, IO<Error, Document>> =>
          Reader.ask<Context>().map((ctx) =>
            IO.forM(async (bind) => {
              const user = await bind(ctx.userService.getById(id));
              return await bind(ctx.documentService.getByUsername(user.username));
            })
          );
      }

      const ctx: Context = { userService: new UserService(), documentService: new DocumentService() };
      const service = new UserDocumentService();

      const effect = service.getById("123").run(ctx);

      const result = await effect.runAsync();

      switch (result.type) {
        case "Ok":
          expect(result.value).toEqual({
            name: "document.pdf",
            createdOn: expect.any(Date),
            createdBy: expect.any(String),
          });
          break;
        case "Err":
          fail("Spec should not fail");
      }
    });
  });

  describe("state management", () => {
    it("should manage user and config state", () => {
      type Context = { user: { name: string; loggedIn: boolean }; config: { theme: string; language: string } };

      const getUserInfo = Reader.ask<Context>().map((ctx) => ctx.user);
      const getConfigInfo = Reader.ask<Context>().map((ctx) => ctx.config);

      const updateTheme = (newTheme: string) =>
        Reader.ask<Context>().map((ctx) => ({
          ...ctx,
          config: { ...ctx.config, theme: newTheme },
        }));

      const initial: Context = {
        user: { name: "Alice", loggedIn: true },
        config: { theme: "light", language: "en" },
      };

      const userInfo = getUserInfo.run(initial);
      const configInfo = getConfigInfo.run(initial);

      expect(userInfo).toEqual({ name: "Alice", loggedIn: true });
      expect(configInfo).toEqual({ theme: "light", language: "en" });

      const updatedContext: Context = updateTheme("dark").run(initial);

      expect(updatedContext).toEqual({
        user: { name: "Alice", loggedIn: true },
        config: { theme: "dark", language: "en" },
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signUp: (...args: unknown[]) => mockSignUp(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

import { useAuth } from "@/hooks/use-auth";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "new-project-id" });
  });

  describe("initial state", () => {
    it("returns isLoading as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    it("exposes signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    it("calls the signIn action with the provided credentials", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "password123");
    });

    it("returns the result from the signIn action", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
      const { result } = renderHook(() => useAuth());

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrongpass");
      });

      expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
    });

    it("sets isLoading to true while signing in, then false after", async () => {
      let resolveSignIn!: (v: unknown) => void;
      mockSignIn.mockReturnValue(new Promise((res) => (resolveSignIn = res)));
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signIn("user@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: false, error: "Invalid credentials" });
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false even when the action throws", async () => {
      mockSignIn.mockRejectedValue(new Error("Network error"));
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    describe("on success — post sign-in routing", () => {
      it("migrates anonymous work and redirects to the created project", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue({
          messages: [{ role: "user", content: "hello" }],
          fileSystemData: {},
        });
        mockCreateProject.mockResolvedValue({ id: "migrated-project-id" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [{ role: "user", content: "hello" }],
            data: {},
          })
        );
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/migrated-project-id");
        expect(mockGetProjects).not.toHaveBeenCalled();
      });

      it("does not migrate anonymous work when the message list is empty", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
        mockGetProjects.mockResolvedValue([{ id: "existing-project-id" }]);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockClearAnonWork).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/existing-project-id");
      });

      it("redirects to the most recent existing project when there is no anon work", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([
          { id: "recent-project" },
          { id: "older-project" },
        ]);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/recent-project");
      });

      it("creates a new project and redirects when there are no existing projects", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "brand-new-project" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
      });

      it("does not navigate when sign-in fails", async () => {
        mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("user@example.com", "wrongpass");
        });

        expect(mockPush).not.toHaveBeenCalled();
        expect(mockCreateProject).not.toHaveBeenCalled();
      });
    });
  });

  describe("signUp", () => {
    it("calls the signUp action with the provided credentials", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "securepass");
      });

      expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "securepass");
    });

    it("returns the result from the signUp action", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });
      const { result } = renderHook(() => useAuth());

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.signUp("existing@example.com", "pass1234");
      });

      expect(returnValue).toEqual({ success: false, error: "Email already registered" });
    });

    it("sets isLoading to true while signing up, then false after", async () => {
      let resolveSignUp!: (v: unknown) => void;
      mockSignUp.mockReturnValue(new Promise((res) => (resolveSignUp = res)));
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signUp("new@example.com", "securepass");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: false });
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false even when the action throws", async () => {
      mockSignUp.mockRejectedValue(new Error("Network error"));
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "securepass").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    describe("on success — post sign-up routing", () => {
      it("migrates anonymous work and redirects to the created project", async () => {
        mockSignUp.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue({
          messages: [{ role: "user", content: "make a form" }],
          fileSystemData: { "/": {} },
        });
        mockCreateProject.mockResolvedValue({ id: "migrated-after-signup" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("new@example.com", "securepass");
        });

        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/migrated-after-signup");
      });

      it("creates a new project and redirects when there are no existing projects", async () => {
        mockSignUp.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "first-project" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("new@example.com", "securepass");
        });

        expect(mockPush).toHaveBeenCalledWith("/first-project");
      });

      it("does not navigate when sign-up fails", async () => {
        mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("existing@example.com", "pass1234");
        });

        expect(mockPush).not.toHaveBeenCalled();
      });
    });
  });
});

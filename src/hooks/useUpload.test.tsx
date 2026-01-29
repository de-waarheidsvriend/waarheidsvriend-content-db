/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpload } from "./useUpload";
import type { ReactNode } from "react";

// Create a wrapper with QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return function TestQueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return initial state", () => {
    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.data).toBeUndefined();
    expect(result.current.progress).toBe(0);
    expect(result.current.step).toBe("uploading");
  });

  it("should provide upload function", () => {
    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.upload).toBe("function");
  });

  it("should provide uploadAsync function", () => {
    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.uploadAsync).toBe("function");
  });

  it("should provide reset function", () => {
    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.reset).toBe("function");
  });

  it("should reset state when reset is called", () => {
    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    // Call reset
    act(() => {
      result.current.reset();
    });

    // State should be back to initial
    expect(result.current.progress).toBe(0);
    expect(result.current.step).toBe("uploading");
    expect(result.current.error).toBe(null);
  });

  it("should have step as a valid UploadStep value", () => {
    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    // The step should be one of the valid UploadStep values
    const validSteps = ["uploading", "processing", "parsing", "completed"];
    expect(validSteps).toContain(result.current.step);
  });
});

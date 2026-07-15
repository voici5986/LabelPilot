import { describe, expect, it } from "vitest";
import { AppError, deserializeAppError, isAppErrorCode } from "./appError";
import { isPdfWorkerResponse } from "./pdfWorkerProtocol";

describe("appError", () => {
  it("accepts only known application error codes", () => {
    expect(isAppErrorCode("qr_error_capacity")).toBe(true);
    expect(isAppErrorCode("unexpected_worker_code")).toBe(false);
  });

  it("does not deserialize an unknown code as AppError", () => {
    const error = deserializeAppError({
      code: "unexpected_worker_code",
      message: "worker detail",
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AppError);
    expect(error.message).toBe("worker detail");
  });

  it("rejects worker error responses with unknown codes", () => {
    expect(
      isPdfWorkerResponse({
        type: "error",
        data: { code: "unexpected_worker_code", message: "worker detail" },
      }),
    ).toBe(false);
  });
});

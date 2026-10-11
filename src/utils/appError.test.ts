import { describe, expect, it } from "vitest";

import {
  AppError,
  deserializeAppError,
  isAppErrorCode,
  serializeAppError,
} from "./appError";
import {
  PDF_WORKER_PROTOCOL_VERSION,
  isPdfWorkerResponse,
} from "./pdfWorkerProtocol";

describe("appError", () => {
  it("round trips the controlled worker version mismatch error", () => {
    const original = new AppError("pdf_worker_version_mismatch", {
      expected: PDF_WORKER_PROTOCOL_VERSION,
      received: "missing",
    });
    expect(deserializeAppError(serializeAppError(original))).toMatchObject({
      code: "pdf_worker_version_mismatch",
      params: { expected: PDF_WORKER_PROTOCOL_VERSION, received: "missing" },
    });
  });
  it("round trips the worker busy error", () => {
    expect(
      deserializeAppError(serializeAppError(new AppError("pdf_worker_busy"))),
    ).toMatchObject({ code: "pdf_worker_busy" });
  });
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
        protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
        requestId: "test-request",
        type: "error",
        data: { code: "unexpected_worker_code", message: "worker detail" },
      }),
    ).toBe(false);
  });
});

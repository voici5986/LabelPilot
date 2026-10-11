import { describe, expect, it } from "vitest";

import { AppError } from "./appError";
import {
  assertProtocolVersion,
  isPdfWorkerGenerateRequest,
  isPdfWorkerResponse,
  PDF_WORKER_PROTOCOL_VERSION,
} from "./pdfWorkerProtocol";

const payload = {
  protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
  config: {
    rows: 1,
    cols: 1,
    marginMm: 0,
    spacingMm: 0,
    orientation: "portrait",
  },
  imageItems: [],
  appMode: "text",
  textConfig: {
    prefix: "SN",
    startNumber: 1,
    digits: 3,
    count: 1,
    showQrCode: false,
    qrSizeRatio: 0.35,
    qrContentPrefix: "",
  },
};

describe("PDF worker protocol versions", () => {
  it.each([undefined, null, "", "   ", 42, "x".repeat(129)])(
    "rejects invalid request IDs %s",
    (requestId) => {
      expect(
        isPdfWorkerGenerateRequest({
          type: "generate",
          requestId,
          data: payload,
        }),
      ).toBe(false);
      for (const type of ["progress", "complete"]) {
        expect(
          isPdfWorkerResponse({
            protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
            requestId,
            type,
            data:
              type === "complete"
                ? new ArrayBuffer(8)
                : { percent: 20, phase: "preparing" },
          }),
        ).toBe(false);
      }
      expect(
        isPdfWorkerResponse({
          protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
          requestId,
          type: "error",
          data: { message: "failure" },
        }),
      ).toBe(requestId === null);
    },
  );

  it("accepts the matching request and every response variant", () => {
    expect(
      isPdfWorkerGenerateRequest({
        type: "generate",
        requestId: "test-request",
        data: payload,
      }),
    ).toBe(true);
    for (const message of [
      { type: "progress", data: { percent: 20, phase: "preparing" } },
      { type: "complete", data: new ArrayBuffer(8) },
      {
        type: "error",
        data: { message: "failure", code: "pdf_worker_version_mismatch" },
      },
    ])
      expect(
        isPdfWorkerResponse({
          protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
          requestId: "test-request",
          ...message,
        }),
      ).toBe(true);
  });

  it.each([undefined, 1, "1", NaN, {}, Infinity])(
    "rejects missing or incompatible version %s in both validators",
    (version) => {
      expect(
        isPdfWorkerGenerateRequest({
          type: "generate",
          requestId: "test-request",
          data: { ...payload, protocolVersion: version },
        }),
      ).toBe(false);
      expect(
        isPdfWorkerResponse({
          protocolVersion: version,
          requestId: "test-request",
          type: "complete",
          data: new ArrayBuffer(8),
        }),
      ).toBe(false);
    },
  );

  it.each([undefined, NaN, Infinity, {}, "secret"])(
    "sanitizes incompatible version %s in the typed error",
    (version) => {
      try {
        assertProtocolVersion(version);
        throw new Error("expected a version mismatch");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error).toMatchObject({
          code: "pdf_worker_version_mismatch",
          params: {
            expected: PDF_WORKER_PROTOCOL_VERSION,
            received: version === undefined ? "missing" : "invalid",
          },
        });
      }
    },
  );
});

// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useFrameProgress } from "./useFrameProgress";

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => frames.delete(id)),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("coalesces a burst to the last percent and phase in one frame", () => {
  const { result } = renderHook(useFrameProgress);
  let run = 0;
  act(() => {
    run = result.current.start({ percent: 0, phase: "reading" });
  });
  act(() => {
    for (let percent = 1; percent <= 80; percent++) {
      result.current.update(run, { percent, phase: "rendering" });
    }
    result.current.update(run, { percent: 90, phase: "serializing" });
  });
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  expect(result.current.progress.percent).toBe(0);
  act(() => {
    frames.get(1)!(0);
  });
  expect(result.current.progress).toEqual({
    percent: 90,
    phase: "serializing",
  });
});

it("does not commit new renders for unchanged progress across frames", () => {
  const committedRender = vi.fn();
  const { result } = renderHook(() => {
    const progress = useFrameProgress();
    useLayoutEffect(() => {
      committedRender();
    });
    return progress;
  });
  let run = 0;
  act(() => {
    run = result.current.start({ percent: 0, phase: "reading" });
  });
  act(() => {
    result.current.update(run, { percent: 20, phase: "rendering" });
  });
  act(() => {
    frames.get(1)!(0);
  });
  const rendersAfterChange = committedRender.mock.calls.length;
  for (let frame = 2; frame <= 12; frame++) {
    act(() => {
      result.current.update(run, { percent: 20, phase: "rendering" });
    });
    act(() => {
      frames.get(frame)!(0);
    });
  }
  expect(committedRender).toHaveBeenCalledTimes(rendersAfterChange);
  act(() => {
    result.current.update(run, { percent: 20, phase: "serializing" });
  });
  act(() => {
    frames.get(13)!(0);
  });
  expect(committedRender).toHaveBeenCalledTimes(rendersAfterChange + 1);
});

it("flushes terminal success and rejects queued and late updates", () => {
  const { result } = renderHook(useFrameProgress);
  let run = 0;
  act(() => {
    run = result.current.start({ percent: 0, phase: "reading" });
  });
  act(() => {
    result.current.update(run, { percent: 50, phase: "rendering" });
  });
  const staleFrame = frames.get(1)!;
  act(() => {
    result.current.finish(run);
  });
  expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  expect(result.current.progress).toEqual({
    percent: 100,
    phase: "serializing",
  });
  act(() => {
    staleFrame(0);
    result.current.update(run, { percent: 10, phase: "reading" });
  });
  expect(result.current.progress.percent).toBe(100);
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
});

it("invalidates old runs on cancel/reset/new start and cancels on unmount", () => {
  const { result, unmount } = renderHook(useFrameProgress);
  let oldRun = 0;
  act(() => {
    oldRun = result.current.start({ percent: 0, phase: "reading" });
  });
  act(() => {
    result.current.update(oldRun, { percent: 60, phase: "rendering" });
  });
  const staleFrame = frames.get(1)!;
  act(() => {
    result.current.cancel();
  });
  let newRun = 0;
  act(() => {
    newRun = result.current.start({ percent: 0, phase: "preparing" });
  });
  act(() => {
    staleFrame(0);
    result.current.update(oldRun, { percent: 90, phase: "serializing" });
    result.current.finish(oldRun);
    result.current.update(newRun, { percent: 20, phase: "preparing" });
  });
  expect(result.current.progress).toEqual({ percent: 0, phase: "preparing" });
  expect(frames.has(2)).toBe(true);
  const lateUpdate = result.current.update;
  unmount();
  expect(cancelAnimationFrame).toHaveBeenCalledWith(2);
  lateUpdate(newRun, { percent: 50, phase: "rendering" });
  expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
});

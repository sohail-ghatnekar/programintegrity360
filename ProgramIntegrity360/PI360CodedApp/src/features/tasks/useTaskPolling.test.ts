import { act, renderHook } from '@testing-library/react';
import { createElement, StrictMode } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskPolling } from './useTaskPolling';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe('useTaskPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls at exactly 3000ms and not before', async () => {
    const readTaskStatus = vi.fn().mockResolvedValue({ status: 'Pending' });
    renderHook(() => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open: true,
      readTaskStatus,
      onCompleted: vi.fn(),
    }));

    await act(() => vi.advanceTimersByTimeAsync(2999));
    expect(readTaskStatus).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(readTaskStatus).toHaveBeenCalledTimes(1);
    expect(readTaskStatus).toHaveBeenCalledWith(1002, 987654);
  });

  it('terminates on close', async () => {
    const readTaskStatus = vi.fn().mockResolvedValue({ status: 'Pending' });
    const { rerender } = renderHook(({ open }) => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open,
      readTaskStatus,
      onCompleted: vi.fn(),
    }), { initialProps: { open: true } });

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(readTaskStatus).toHaveBeenCalledTimes(1);
    rerender({ open: false });
    await act(() => vi.advanceTimersByTimeAsync(9000));
    expect(readTaskStatus).toHaveBeenCalledTimes(1);
  });

  it('terminates after two minutes', async () => {
    const readTaskStatus = vi.fn().mockResolvedValue({ status: 'Pending' });
    const { result } = renderHook(() => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open: true,
      readTaskStatus,
      onCompleted: vi.fn(),
    }));

    await act(() => vi.advanceTimersByTimeAsync(120_000));
    const callsAtTimeout = readTaskStatus.mock.calls.length;
    expect(callsAtTimeout).toBe(39);
    expect(result.current.state).toBe('timed-out');
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(readTaskStatus).toHaveBeenCalledTimes(callsAtTimeout);
  });

  it('retries transient failures without falsely completing', async () => {
    const readTaskStatus = vi.fn()
      .mockRejectedValueOnce(new Error('temporary 503'))
      .mockResolvedValue({ status: 'Pending' });
    const onCompleted = vi.fn();
    const { result } = renderHook(() => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open: true,
      readTaskStatus,
      onCompleted,
    }));

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(result.current.state).toBe('retrying');
    expect(onCompleted).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(result.current.state).toBe('polling');
    expect(readTaskStatus).toHaveBeenCalledTimes(2);
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it.each([
    [Object.assign(new Error('bad request'), { status: 400 }), 'bad request'],
    [Object.assign(new Error('authentication required'), { response: { status: 401 } }), 'authentication required'],
    [Object.assign(new Error('forbidden'), { statusCode: 403 }), 'forbidden'],
    [Object.assign(new Error('missing task'), { response: { status: 404 } }), 'missing task'],
    [new Error('task validation failed'), 'task validation failed'],
    [new Error('task was not found'), 'task was not found'],
  ])('stops polling on terminal task-read failure %s', async (readError, expectedMessage) => {
    const readTaskStatus = vi.fn().mockRejectedValue(readError);
    const onCompleted = vi.fn();
    const { result } = renderHook(() => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open: true,
      readTaskStatus,
      onCompleted,
    }));

    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(result.current.state).toBe('terminal-unavailable');
    expect(result.current.error).toContain(expectedMessage);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(readTaskStatus).toHaveBeenCalledTimes(1);
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: 429 }, 'rate limited'],
    [{ statusCode: 503 }, 'service unavailable'],
    [{ response: { status: 500 } }, 'server error'],
    [new Error('network request failed'), 'network failure'],
  ])('retries likely transient task-read failure %s', async (shape, message) => {
    const error = shape instanceof Error ? shape : Object.assign(new Error(message), shape);
    const readTaskStatus = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ status: 'Pending' });
    const { result } = renderHook(() => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open: true,
      readTaskStatus,
      onCompleted: vi.fn(),
    }));

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(result.current.state).toBe('retrying');
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(result.current.state).toBe('polling');
    expect(readTaskStatus).toHaveBeenCalledTimes(2);
  });

  it('invokes completion once and terminates after Tasks API returns Completed', async () => {
    const readTaskStatus = vi.fn().mockResolvedValue({ status: 'Completed' });
    const onCompleted = vi.fn();
    const { result } = renderHook(() => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open: true,
      readTaskStatus,
      onCompleted,
    }));

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(result.current.state).toBe('completed');
    expect(onCompleted).toHaveBeenCalledWith(1002);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(readTaskStatus).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('keeps completion terminal when onCompleted rejects', async () => {
    const readTaskStatus = vi.fn().mockResolvedValue({ status: 'Completed' });
    const onCompleted = vi.fn().mockRejectedValue(new Error('workspace refresh failed'));
    const { result } = renderHook(() => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open: true,
      readTaskStatus,
      onCompleted,
    }));

    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(result.current.state).toBe('completed');
    expect(result.current.completionRefreshState).toBe('failed');
    expect(result.current.completionRefreshError).toContain('workspace refresh failed');
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(result.current.state).toBe('completed');
    expect(readTaskStatus).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('retains confirmed completion while the completion refresh temporarily removes the live reader', async () => {
    const readTaskStatus = vi.fn().mockResolvedValue({ status: 'Completed' });
    const onCompleted = vi.fn();
    const { result, rerender } = renderHook(({ reader }) => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open: true,
      readTaskStatus: reader,
      onCompleted,
    }), { initialProps: { reader: readTaskStatus as typeof readTaskStatus | undefined } });

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(result.current.state).toBe('completed');

    rerender({ reader: undefined });
    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(result.current.state).toBe('completed');
    expect(readTaskStatus).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('does not poll without an injected live reader', async () => {
    const onCompleted = vi.fn();
    const { result } = renderHook(() => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open: true,
      onCompleted,
    }));

    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(result.current.state).toBe('unavailable');
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('starts the existing session when a reader arrives later', async () => {
    const readTaskStatus = vi.fn().mockResolvedValue({ status: 'Pending' });
    const { result, rerender } = renderHook(({ reader }) => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open: true,
      readTaskStatus: reader,
      onCompleted: vi.fn(),
    }), { initialProps: { reader: undefined as typeof readTaskStatus | undefined } });

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(result.current.state).toBe('unavailable');
    rerender({ reader: readTaskStatus });
    await act(() => vi.advanceTimersByTimeAsync(2999));
    expect(readTaskStatus).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(readTaskStatus).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('polling');
  });

  it('times out an in-flight read and ignores its late completion', async () => {
    const read = deferred<{ status: string }>();
    const readTaskStatus = vi.fn().mockReturnValue(read.promise);
    const onCompleted = vi.fn();
    const { result } = renderHook(() => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open: true,
      readTaskStatus,
      onCompleted,
    }));

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(readTaskStatus).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(117_000));
    expect(result.current.state).toBe('timed-out');
    expect(readTaskStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      read.resolve({ status: 'Completed' });
      await read.promise;
    });

    expect(result.current.state).toBe('timed-out');
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('does not duplicate polling or completion callbacks in StrictMode', async () => {
    const readTaskStatus = vi.fn().mockResolvedValue({ status: 'Completed' });
    const onCompleted = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);
    const { result } = renderHook(() => useTaskPolling({
      taskId: 1002,
      folderId: 987654,
      open: true,
      readTaskStatus,
      onCompleted,
    }), { wrapper });

    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(result.current.state).toBe('completed');
    expect(readTaskStatus).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });
});

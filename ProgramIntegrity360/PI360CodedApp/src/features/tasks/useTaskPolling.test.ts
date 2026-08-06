import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskPolling } from './useTaskPolling';

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
});

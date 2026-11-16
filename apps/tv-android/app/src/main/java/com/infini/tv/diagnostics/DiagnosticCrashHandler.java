package com.infini.tv.diagnostics;

/** Saves Java crashes locally before preserving Android's normal fatal-exception behavior. */
public final class DiagnosticCrashHandler implements Thread.UncaughtExceptionHandler {
  public interface Sink { void save(Thread thread, Throwable error); }
  private final Sink sink;
  private final Thread.UncaughtExceptionHandler previous;

  public DiagnosticCrashHandler(Sink sink, Thread.UncaughtExceptionHandler previous) {
    this.sink = sink; this.previous = previous;
  }

  /** Never performs network I/O and delegates even when crash logging itself fails. */
  @Override public void uncaughtException(Thread thread, Throwable error) {
    try { sink.save(thread, error); } catch (Throwable ignored) { }
    finally {
      if (previous != null) previous.uncaughtException(thread, error);
    }
  }
}

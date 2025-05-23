/*
 * Copyright (C) 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package dev.perfetto.sdk;

import dalvik.annotation.optimization.CriticalNative;
import dalvik.annotation.optimization.FastNative;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Holds extras to be passed to Perfetto track events in {@link PerfettoTrace}.
 *
 * @hide
 */
final class PerfettoTrackEventExtra {
  private static final AtomicLong sNamedTrackId = new AtomicLong();

  static class NativeAllocationRegistry {
    public static NativeAllocationRegistry createMalloced(
        ClassLoader classLoader, long freeFunction) {
      // do nothing
      return new NativeAllocationRegistry();
    }

    public void registerNativeAllocation(Object obj, long ptr) {
      // do nothing
    }
  }

  private static final NativeAllocationRegistry sRegistry =
      NativeAllocationRegistry.createMalloced(
          PerfettoTrackEventExtra.class.getClassLoader(), native_delete());

  private final long mPtr;

  PerfettoTrackEventExtra() {
    mPtr = native_init();
  }

  /** Returns the native pointer. */
  public long getPtr() {
    return mPtr;
  }

  /** Adds a pointer representing a track event parameter. */
  public void addPerfettoPointer(PerfettoPointer extra) {
    native_add_arg(mPtr, extra.getPtr());
  }

  /** Resets the track event extra. */
  public void reset() {
    native_clear_args(mPtr);
  }

  @CriticalNative
  private static native long native_init();

  @CriticalNative
  private static native long native_delete();

  @CriticalNative
  private static native void native_add_arg(long ptr, long extraPtr);

  @CriticalNative
  private static native void native_clear_args(long ptr);

  @FastNative
  public static native void native_emit(int type, long tag, String name, long ptr);

  /** Represents a native pointer to a Perfetto C SDK struct. E.g. PerfettoTeHlExtra. */
  interface PerfettoPointer {
    /** Returns the perfetto struct native pointer. */
    long getPtr();
  }

  /** Container for {@link Field} instances. */
  interface FieldContainer {
    /** Add {@link Field} to the container. */
    void addField(PerfettoPointer field);
  }

  static final class Flow implements PerfettoPointer {
    private final long mPtr;
    private final long mExtraPtr;

    Flow() {
      mPtr = native_init();
      mExtraPtr = native_get_extra_ptr(mPtr);
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    public void setProcessFlow(long type) {
      native_set_process_flow(mPtr, type);
    }

    public void setProcessTerminatingFlow(long id) {
      native_set_process_terminating_flow(mPtr, id);
    }

    @Override
    public long getPtr() {
      return mExtraPtr;
    }

    @CriticalNative
    private static native long native_init();

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native void native_set_process_flow(long ptr, long type);

    @CriticalNative
    private static native void native_set_process_terminating_flow(long ptr, long id);

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);
  }

  static final class NamedTrack implements PerfettoPointer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(NamedTrack.class.getClassLoader(), native_delete());

    private final long mPtr;
    private final long mExtraPtr;
    private final String mName;

    NamedTrack(String name, long parentUuid) {
      mPtr = native_init(sNamedTrackId.incrementAndGet(), name, parentUuid);
      mExtraPtr = native_get_extra_ptr(mPtr);
      mName = name;
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mExtraPtr;
    }

    public String getName() {
      return mName;
    }

    @FastNative
    private static native long native_init(long id, String name, long parentUuid);

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);
  }

  static final class CounterTrack implements PerfettoPointer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(
            CounterTrack.class.getClassLoader(), native_delete());

    private final long mPtr;
    private final long mExtraPtr;
    private final String mName;

    CounterTrack(String name, long parentUuid) {
      mPtr = native_init(name, parentUuid);
      mExtraPtr = native_get_extra_ptr(mPtr);
      mName = name;
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mExtraPtr;
    }

    public String getName() {
      return mName;
    }

    @FastNative
    private static native long native_init(String name, long parentUuid);

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);
  }

  static final class CounterInt64 implements PerfettoPointer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(
            CounterInt64.class.getClassLoader(), native_delete());

    private final long mPtr;
    private final long mExtraPtr;

    CounterInt64() {
      mPtr = native_init();
      mExtraPtr = native_get_extra_ptr(mPtr);
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mExtraPtr;
    }

    public void setValue(long value) {
      native_set_value(mPtr, value);
    }

    @CriticalNative
    private static native long native_init();

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native void native_set_value(long ptr, long value);

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);
  }

  static final class CounterDouble implements PerfettoPointer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(
            CounterDouble.class.getClassLoader(), native_delete());

    private final long mPtr;
    private final long mExtraPtr;

    CounterDouble() {
      mPtr = native_init();
      mExtraPtr = native_get_extra_ptr(mPtr);
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mExtraPtr;
    }

    public void setValue(double value) {
      native_set_value(mPtr, value);
    }

    @CriticalNative
    private static native long native_init();

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native void native_set_value(long ptr, double value);

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);
  }

  static final class ArgInt64 implements PerfettoPointer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(ArgInt64.class.getClassLoader(), native_delete());

    // Private pointer holding Perfetto object with metadata
    private final long mPtr;

    // Public pointer to Perfetto object itself
    private final long mExtraPtr;

    private final String mName;

    ArgInt64(String name) {
      mPtr = native_init(name);
      mExtraPtr = native_get_extra_ptr(mPtr);
      mName = name;
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mExtraPtr;
    }

    public String getName() {
      return mName;
    }

    public void setValue(long val) {
      native_set_value(mPtr, val);
    }

    @FastNative
    private static native long native_init(String name);

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);

    @CriticalNative
    private static native void native_set_value(long ptr, long val);
  }

  static final class ArgBool implements PerfettoPointer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(ArgBool.class.getClassLoader(), native_delete());

    // Private pointer holding Perfetto object with metadata
    private final long mPtr;

    // Public pointer to Perfetto object itself
    private final long mExtraPtr;

    private final String mName;

    ArgBool(String name) {
      mPtr = native_init(name);
      mExtraPtr = native_get_extra_ptr(mPtr);
      mName = name;
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mExtraPtr;
    }

    public String getName() {
      return mName;
    }

    public void setValue(boolean val) {
      native_set_value(mPtr, val);
    }

    @FastNative
    private static native long native_init(String name);

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);

    @CriticalNative
    private static native void native_set_value(long ptr, boolean val);
  }

  static final class ArgDouble implements PerfettoPointer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(ArgDouble.class.getClassLoader(), native_delete());

    // Private pointer holding Perfetto object with metadata
    private final long mPtr;

    // Public pointer to Perfetto object itself
    private final long mExtraPtr;

    private final String mName;

    ArgDouble(String name) {
      mPtr = native_init(name);
      mExtraPtr = native_get_extra_ptr(mPtr);
      mName = name;
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mExtraPtr;
    }

    public String getName() {
      return mName;
    }

    public void setValue(double val) {
      native_set_value(mPtr, val);
    }

    @FastNative
    private static native long native_init(String name);

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);

    @CriticalNative
    private static native void native_set_value(long ptr, double val);
  }

  static final class ArgString implements PerfettoPointer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(ArgString.class.getClassLoader(), native_delete());

    // Private pointer holding Perfetto object with metadata
    private final long mPtr;

    // Public pointer to Perfetto object itself
    private final long mExtraPtr;

    private final String mName;

    ArgString(String name) {
      mPtr = native_init(name);
      mExtraPtr = native_get_extra_ptr(mPtr);
      mName = name;
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mExtraPtr;
    }

    public String getName() {
      return mName;
    }

    public void setValue(String val) {
      native_set_value(mPtr, val);
    }

    @FastNative
    private static native long native_init(String name);

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);

    @FastNative
    private static native void native_set_value(long ptr, String val);
  }

  static final class Proto implements PerfettoPointer, FieldContainer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(Proto.class.getClassLoader(), native_delete());

    // Private pointer holding Perfetto object with metadata
    private final long mPtr;

    // Public pointer to Perfetto object itself
    private final long mExtraPtr;

    Proto() {
      mPtr = native_init();
      mExtraPtr = native_get_extra_ptr(mPtr);
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mExtraPtr;
    }

    @Override
    public void addField(PerfettoPointer field) {
      native_add_field(mPtr, field.getPtr());
    }

    public void clearFields() {
      native_clear_fields(mPtr);
    }

    @CriticalNative
    private static native long native_init();

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);

    @CriticalNative
    private static native void native_add_field(long ptr, long extraPtr);

    @CriticalNative
    private static native void native_clear_fields(long ptr);
  }

  static final class FieldInt64 implements PerfettoPointer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(FieldInt64.class.getClassLoader(), native_delete());

    // Private pointer holding Perfetto object with metadata
    private final long mPtr;

    // Public pointer to Perfetto object itself
    private final long mFieldPtr;

    FieldInt64() {
      mPtr = native_init();
      mFieldPtr = native_get_extra_ptr(mPtr);
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mFieldPtr;
    }

    public void setValue(long id, long val) {
      native_set_value(mPtr, id, val);
    }

    @CriticalNative
    private static native long native_init();

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);

    @CriticalNative
    private static native void native_set_value(long ptr, long id, long val);
  }

  static final class FieldDouble implements PerfettoPointer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(
            FieldDouble.class.getClassLoader(), native_delete());

    // Private pointer holding Perfetto object with metadata
    private final long mPtr;

    // Public pointer to Perfetto object itself
    private final long mFieldPtr;

    FieldDouble() {
      mPtr = native_init();
      mFieldPtr = native_get_extra_ptr(mPtr);
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mFieldPtr;
    }

    public void setValue(long id, double val) {
      native_set_value(mPtr, id, val);
    }

    @CriticalNative
    private static native long native_init();

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);

    @CriticalNative
    private static native void native_set_value(long ptr, long id, double val);
  }

  static final class FieldString implements PerfettoPointer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(
            FieldString.class.getClassLoader(), native_delete());

    // Private pointer holding Perfetto object with metadata
    private final long mPtr;

    // Public pointer to Perfetto object itself
    private final long mFieldPtr;

    FieldString() {
      mPtr = native_init();
      mFieldPtr = native_get_extra_ptr(mPtr);
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mFieldPtr;
    }

    public void setValue(long id, String val) {
      native_set_value(mPtr, id, val);
    }

    @CriticalNative
    private static native long native_init();

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);

    @FastNative
    private static native void native_set_value(long ptr, long id, String val);
  }

  static final class FieldNested implements PerfettoPointer, FieldContainer {
    private static final NativeAllocationRegistry sRegistry =
        NativeAllocationRegistry.createMalloced(
            FieldNested.class.getClassLoader(), native_delete());

    // Private pointer holding Perfetto object with metadata
    private final long mPtr;

    // Public pointer to Perfetto object itself
    private final long mFieldPtr;

    FieldNested() {
      mPtr = native_init();
      mFieldPtr = native_get_extra_ptr(mPtr);
      sRegistry.registerNativeAllocation(this, mPtr);
    }

    @Override
    public long getPtr() {
      return mFieldPtr;
    }

    @Override
    public void addField(PerfettoPointer field) {
      native_add_field(mPtr, field.getPtr());
    }

    public void setId(long id) {
      native_set_id(mPtr, id);
    }

    @CriticalNative
    private static native long native_init();

    @CriticalNative
    private static native long native_delete();

    @CriticalNative
    private static native long native_get_extra_ptr(long ptr);

    @CriticalNative
    private static native void native_add_field(long ptr, long extraPtr);

    @CriticalNative
    private static native void native_set_id(long ptr, long id);
  }
}
